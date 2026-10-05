# Pi Chat integration-test driver layer

## Status

The core multi-session `PiChatDriver` milestone is implemented: `Chat`, `Browser`,
and `Tabs` drivers cover prompt/reply, reconnect restoration, repeated identical
prompts, creation from home, independent tab transcripts, active/background tab
closure, and reconnect/recreation at home in the normal Vitest suite. An isolated
harness-backed factory creates real Pi sessions. Shared support owns cleanup,
per-session scripts, browser reducers, and bounded event-driven waits.
Follow-up slices cover project folder browsing/opening and errors, controlled
response abort, controller takeover, and real Pi extension confirmation UI.
The `Extensions` driver covers registered commands, confirmation/cancellation,
notifications, widgets, pending-prompt reconnect, and per-session isolation.
Scenarios live under `test/scenarios/`; reusable drivers and their tests are
separate under `test/infra/` and `test/infra-tests/`. See [DRIVERS.md](DRIVERS.md).
Persisted session reopening, active-model-turn reconnect, and broader extension
actions/reload remain planned. Current verification uses root Pi SDK 1.0.2.

### Initial harness spike

The commit-pinned GitHub ManuelSelch fork of
`@marcfargas/pi-test-harness@0.6.1` now passes a compatibility spike with Pi
0.85.1: a real SDK session wrapped in `AgentSessionRuntime`, attached through
`PiRuntimeAdapter.fromRuntime`, and driven over the real Pi Chat WebSocket
server. Prompt/reply and reconnect transcript restoration pass. The fork adds
`prepare()` to configure responses without directly submitting prompts.
See [SPIKE.md](SPIKE.md) and `scripts/spikes/pi-test-harness.ts` for reproduction
and scope. The fork is a declared dev dependency pinned to commit
`7ade82c6c7de2ae85f69df1c442a515b63c6dadc`, with Pi AI/agent-core peers initially pinned
to 0.85.1 (the root SDK dependencies have since been upgraded to 1.0.2). `npm ci && npm run test:spike` reproduces it without a local checkout.

This plan follows the driver pattern already used in the BlueFlow
integration tests: integration tests obtain an application-level driver/context,
and feature drivers expose semantic operations and assertions. The tests remain
ordinary imperative TypeScript tests. There is no `given / when / then` DSL and no
scenario parser.

## Goal

Create a driver layer that lets integration tests describe real Pi Chat user
scenarios through stable feature APIs while hiding WebSocket protocol plumbing,
message queues, server setup, and runtime fixtures.

A test should look approximately like this:

```ts
const app = await PiChatDriver.start();

await app.Projects.Open(project.path);
await app.Tabs.Create(project.path);
await app.Chat.SendPrompt("Explain this project");
await app.Chat.WaitUntilIdle();

app.Chat.ShouldContainMessages([
  { role: "user", text: "Explain this project" },
  { role: "assistant", text: "Hello from Pi Chat." },
]);

await app.Browser.Reconnect();
app.Chat.ShouldContainMessages(/* same transcript */);
```

The driver is the DSL. Its API should use product vocabulary—`Chat`, `Tabs`,
`Projects`, `Extensions`, and browser-level operations—rather than `given`,
`when`, and `then` words or transport terminology.

## Existing pattern to follow

The relevant established pattern is the BlueFlow integration architecture:

- a shared integration context owns test infrastructure and lifecycle;
- a root application driver exposes feature drivers (`app.Main`, `app.Editor`,
  `app.Config`, etc.); Pi Chat should use the same pattern with `app.Chat`,
  `app.Tabs`, and `app.Projects`.
- each driver owns operations for one feature and exposes semantic assertions;
- low-level UI/protocol mechanics remain inside drivers;
- operations that cross asynchronous boundaries return/await the underlying task;
- drivers poll meaningful state or await completion signals instead of using
  arbitrary delays;
- assertions use domain terms such as `ShouldContain`, `ShouldBe`, and
  `ShouldHave...` rather than inspecting implementation state directly.

Pi Chat should adapt this pattern to its browser/server architecture rather than
copying WinForms concepts literally.

## Goals

1. Provide a reusable `PiChatDriver` root object, exposed as `app` in tests.
2. Expose semantic feature drivers for user-visible product behavior.
3. Exercise the real server, application service, transport, protocol schemas,
   and real Pi runtime with a deterministic model boundary together, while hiding
   those implementation details.
4. Keep test scenarios readable as imperative user workflows.
5. Make asynchronous behavior deterministic and failures diagnosable.
6. Keep the driver API independent of whether the test is backed by a protocol
   client or a visible browser.

## Non-goals

- A Gherkin, Given/When/Then, YAML, or natural-language scenario format.
- A general-purpose test framework on top of Vitest.
- Replacing focused unit, application-service, protocol, or DOM tests.
- Testing real Pi providers, credentials, or model quality in CI.
- Introducing production dependencies on test drivers.
- Supporting multi-user product behavior in this first driver layer.

## Proposed driver hierarchy

```text
PiChatDriver
├── Browser          # launch/reload/reconnect/take control at user level
├── Tabs             # create/open/close/switch/rename tabs
├── Chat             # prompt, abort, streaming, transcript and runtime state
├── Projects         # folder browsing, opening folders, path/error assertions
├── Extensions       # actions, notifications, widgets, prompts and reload
└── Diagnostics      # internal failure history and artifacts
```

The root context also owns the test world:

- `createPiChatServer()` and an ephemeral loopback listener;
- an `@marcfargas/pi-test-harness` session/factory for real Pi runtime behavior
  with deterministic model responses;
- temporary project/session directories;
- the Pi Chat browser-facing client;
- cleanup and timeout policy.

The Pi test harness is responsible for mocking the model boundary. Pi extensions,
extension hooks, tool registration, session state, and UI calls should run through
real Pi code. Pi Chat should not grow another `FakeRuntimeAdapter` for those
concerns unless a specific Pi Chat boundary cannot be represented by the harness.

The root is created and disposed by a test fixture. Feature drivers receive a
narrow shared context and must not construct their own server, socket, or runtime.

## Driver responsibilities

### `PiChatDriver`

- `start(options?)` creates an isolated test world and launches the test client.
- Exposes feature drivers and test resources through `app`.
- Owns lifecycle cleanup in `dispose()`.
- Produces a diagnostics snapshot on failure.

The driver may use a WebSocket client internally in the first implementation,
but that is not part of the public vocabulary. Tests use browser-level methods
such as `app.Browser.Reconnect()` and `app.Browser.TakeControl()`.

### `BrowserDriver`

Owns user-level browser lifecycle behavior:

- `Reconnect()`;
- `Reload()`;
- `TakeControl()`;
- `ShouldBeUsable()`;
- `ShouldHaveLostControl()`.

It hides socket creation, close codes, message handlers, protocol validation, and
snapshot reconstruction. Tests should not call `socket.send`, attach raw message
handlers, or parse JSON. A later visible-browser implementation can replace the
internal client without changing the test vocabulary.

### `TabDriver`

Owns user-visible tab operations, not session-registry internals:

- `Create(projectPath?)`;
- `Open(sessionPath)`;
- `SwitchTo(tab)`;
- `Close(tab)`;
- `Rename(name)`;
- `ShouldBeActive(tab)`;
- `ShouldContain(expected)`;
- `ShouldHaveName(name)`.

Tab methods should return useful handles when a later operation needs a specific
tab, for example `const tab = await app.Tabs.Create(project.path)`. The driver
may use session IDs internally, but those IDs should not shape normal test code.

### `ChatDriver`

Owns chat operations and transcript assertions:

- `SendPrompt(text)`;
- `Abort()`;
- `WaitUntilStreaming()` / `WaitUntilIdle()`;
- `ShouldContainMessages(expected)`;
- `ShouldHaveMessageCount(count)`;
- `ShouldShowRuntimeError(text)`;
- `ShouldHaveNoDuplicateMessages()`;
- `ShouldHaveAssistantReply(text)`.

`SendPrompt` should wait for the prompt command to be accepted, while
`WaitUntilIdle` should wait for the runtime status transition. The driver should
translate a domain-level response script into the harness playbook; tests should
not call `when`, `calls`, or `says` directly. For controlled long-running flows,
use the harness's controllable stream/model support rather than adding another
fake runtime.

### `ProjectDriver`

Owns server-folder behavior:

- `Browse(path)`;
- `Open(path)`;
- `StartSessionHere(path)`;
- `ShouldShowPath(path)`;
- `ShouldShowRecoverableError(message)`;
- `ShouldNotHaveOpenedPreviousPath()`.

It uses temporary folders supplied by the test world and verifies the same
canonical-path/error behavior used by the browser protocol.

### `ExtensionDriver`

Owns extension-visible behavior without reaching into the registry directly.
The underlying Pi UI mocking should use `@marcfargas/pi-test-harness` where
possible:

- `RunAction(actionId, state?)`;
- `ShouldShowNotification(message, level?)`;
- `ShouldShowWidget(key, lines?)`;
- `ShouldShowPrompt(prompt)`;
- `RespondToPrompt(promptId, result)`;
- `Reload()` where extension cache behavior is under test.

Extension fixture registration can be an explicit application option, for
example `PiChatDriver.start({ extensions })`, rather than a hidden
process-global dependency.

## Internal implementation layers

The public API has one driver layer. Internally, the first implementation may
still have these private collaborators:

```text
PiChatDriver       domain-specific operations used by tests
Client adapter     receives browser-facing state and sends user commands
Test world         server, harness-backed real Pi runtime, temporary resources, cleanup
```

The client adapter is what was previously described as a “protocol driver”. It is
not a second public DSL or a second kind of test. It is simply an implementation
behind `PiChatDriver`, initially backed by WebSocket messages. A future visible
browser adapter is an alternative implementation only if needed. Neither adapter
should leak socket or browser-library types into the test API.

Low-level protocol tests remain allowed and should stay in their existing focused
test files.

The protocol client should maintain:

- latest tabs, catalogue, and per-session snapshots;
- ordered protocol messages;
- waiters for message types and state predicates;
- connection close code/reason;
- recent messages for diagnostics.

All incoming data must be validated with the shared schemas. Driver waits must be
bounded and include the driver method, predicate, latest state, and recent
messages in timeout errors.

## Client implementation

The first `PiChatDriver` implementation can use a private WebSocket client to
communicate with the real Pi Chat server. This is an implementation detail, not a
second public driver or DSL. A visible browser client is optional and should only
be added if a user-flow cannot be covered through the browser-facing client.

If it is added later, it must preserve the same domain-specific API (`Tabs.Create`,
`Chat.SendPrompt`, `Browser.Reconnect`, and so on). It must not leak Playwright or
socket types into tests. Browser-specific layout assertions remain in existing
DOM tests or dedicated browser smoke tests.

## Initial integration scenarios

Write ordinary Vitest tests using the drivers. Suggested first scenarios:

1. **Create a session and send a prompt**
   - start application on home;
   - open a temporary project and start a session;
   - send a prompt and wait for idle;
   - assert ordered user/assistant messages.
2. **Reconnect restores the current session**
   - complete a prompt;
   - reconnect through `app.Browser.Reconnect()`;
   - assert active session, transcript, and message uniqueness.
3. **Manage multiple sessions**
   - start two sessions;
   - send separate prompts;
   - switch tabs and assert each transcript belongs to the correct session.
4. **Abort a running prompt**
   - configure a controlled long-running mocked model response;
   - call `app.Chat.Abort()`;
   - assert the runtime settles and no late output corrupts the transcript.
5. **Extension UI flow**
   - trigger a prompt/widget/action through `app.Extensions`;
   - respond or invoke it;
   - assert notification and resulting snapshot state.
6. **Controller replacement**
   - create a second connection driver;
   - connect it;
   - assert the first connection was replaced and the second can rebuild state.
7. **Folder selection**
   - open a valid temporary folder;
   - submit an invalid path;
   - assert recoverable error and no accidental navigation to the prior folder.

## Incremental implementation plan

1. **Document and freeze driver boundaries**
   - agree on root context and feature-driver names;
   - define timeout and assertion error conventions;
   - keep the public API imperative and product-oriented.
2. **Extract the protocol client**
   - move reusable connection/message waiting code from
     `test/modules/server/transport/websocket-transport.test.ts` into test support;
   - retain existing low-level tests and avoid changing production protocol.
3. **Implement test world and root application driver**
   - start/stop isolated `PiChatServer` instances;
   - inject the Pi test-harness-backed runtime/factory and temporary folders;
   - guarantee cleanup after partial setup failures.
4. **Implement `BrowserDriver` and `TabDriver`**
   - cover home, tab creation, reconnect, tab switching, and takeover;
   - add driver-focused tests for control replacement and snapshot rebuild.
5. **Integrate `@marcfargas/pi-test-harness` and implement `ChatDriver`**
   - verify the harness peer dependency against the pinned
     `@earendil-works/pi-coding-agent@0.85.1`;
   - configure deterministic response playbooks behind `ChatDriver`;
   - support prompt, streaming completion, abort, transcript projection, and
     semantic assertions;
   - extend the harness only when a concrete Pi Chat scenario requires a missing capability.
6. **Implement `ProjectDriver` and `ExtensionDriver`**
   - cover folder errors and extension prompt/widget/action flows;
   - ensure extension fixtures are explicit and isolated.
7. **Add the initial integration scenarios**
   - migrate only complete user flows; do not rewrite all focused tests;
   - keep scenario names descriptive and tests imperative.
8. **Evaluate a visible-browser implementation**
   - add only if the client-backed driver leaves meaningful visible UI behavior uncovered;
   - reuse the driver vocabulary and keep browser smoke tests separately named.

## Design rules

- Drivers expose domain operations; tests do not send raw protocol messages.
- Drivers do not expose mutable internal snapshots for assertions. Provide
  semantic `Should...` methods and immutable read models only where necessary.
- Every asynchronous driver operation returns/awaits the underlying task.
- Never synchronize with arbitrary `setTimeout`/`Task.Delay`; await browser state,
  client lifecycle, or explicit Pi-harness completion.
- Keep setup and cleanup in `PiChatDriver`, not in every feature driver.
- Do not hide cross-feature sequencing: a tab driver may use the private client
  adapter, but tests should only see domain operations.
- Keep drivers test-only and dependency-inverted from production modules.
- Run scenarios serially when process-global extension cache or shared runtime
  state makes parallel execution unsafe; otherwise use isolated worlds.

## Acceptance criteria

The first milestone is complete when:

- `@marcfargas/pi-test-harness` is verified against the pinned Pi runtime and
  provides the deterministic Pi session used by integration tests;
- `PiChatDriver` starts and disposes an isolated server reliably;
- browser, tab, and chat drivers cover the first three scenarios;
- tests contain no raw WebSocket plumbing for those scenarios;
- failures include driver method, current session/tabs, recent protocol messages,
  and the last relevant snapshot;
- `npm test -- --run`, `npx tsc --noEmit`, and `npm run build` pass;
- adding a new user-flow test requires using feature-driver methods rather than
  learning `ChatApplicationService` or transport internals.

## Open decisions

1. **Resolved:** the root is `PiChatDriver`, instantiated as `app` in tests.
2. **Clarified:** “protocol driver” means only a private client adapter used by
   `PiChatDriver` to receive browser-facing state and send user commands. It is
   not a public test abstraction. A visible browser adapter is optional and can
   be added later only if protocol-backed tests leave UI behavior uncovered.
3. **Use the existing Pi harness:** `@marcfargas/pi-test-harness` already
   replaces only `streamFn`, supports playbook-driven responses, intercepts
   selected tools, mocks `ctx.ui.*`, records events, and provides diagnostics.
   `PiChatDriver` should wrap this capability and translate it into domain
   operations. Do not add a second fake runtime unless a missing capability is
   demonstrated by a Pi Chat scenario.
4. **Resolved naming rule:** public methods use domain language such as
   `app.Tabs.Create()`, `app.Tabs.Open()`, `app.Tabs.SwitchTo()`,
   `app.Browser.Reconnect()`, and `app.Browser.TakeControl()`. Socket names,
   close codes, session-registry operations, and protocol message types stay
   inside the driver implementation or low-level transport tests.

5. **Verified:** the pinned fork fixes the import/auth/stream function mismatches.
   Its real session is wrapped in `AgentSessionRuntime` and attached via
   `PiRuntimeAdapter.fromRuntime()`. This runs in normal integration tests.
6. **Implemented runtime factory seam:** test-only `TestWorld` implements the
   existing `RuntimeAdapterFactory.newSession` with real harness-created sessions
   in its temporary project. It owns independent scripts/services and idempotent
   cleanup, including closed tabs and in-flight creation. Persisted session open/
   continue and runtime replacement explicitly reject until a later slice.
7. **Implemented response configuration:**
   `PiChatDriver.start({ responses: [{ prompt, reply }] })` translates domain
   scripts to harness playbooks internally. `Tabs.Create({ responses })` supplies
   an independent script to a new conversation. Missing/mismatched prompts fail
   before submission; `Chat.ShouldHaveConsumedResponses()` asserts completion for
   the active tab. `startAtHome: true` starts with no conversation.
8. **Client coverage level:** decide whether the first milestone uses only a
   private browser-facing WebSocket client, or also mounts the React application
   for a small number of DOM-backed user flows. The protocol client should be
   the default because it is faster and exercises the server boundary directly.
9. **Isolation and parallelism:** decide whether extension loading/cache state
   requires serial driver tests, or whether each driver can use an isolated
   extension registry and run in parallel. Start conservatively and parallelize
   only after observing the actual process-global constraints.
