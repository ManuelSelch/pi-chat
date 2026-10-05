# Pi Chat integration drivers

`test/infra/pi-chat/pi-chat-driver.ts` is the test-only application root. Use
ordinary imperative TypeScript workflows, with the driver named `app`:

```ts
import { PiChatDriver } from "../../test/infra/pi-chat/pi-chat-driver.js";

const app = await PiChatDriver.start({
  responses: [{ prompt: "Hello", reply: "Hello from Pi Chat." }],
});
try {
  await app.Chat.SendPrompt("Hello");
  await app.Chat.WaitUntilIdle();
  app.Chat.ShouldHaveAssistantReply("Hello from Pi Chat.");
  await app.Browser.Reconnect();
  app.Browser.ShouldBeUsable();
  app.Chat.ShouldContainMessages([
    { role: "user", text: "Hello" },
    { role: "assistant", text: "Hello from Pi Chat." },
  ]);
  app.Chat.ShouldHaveMessageCount(2);
  app.Chat.ShouldHaveNoDuplicateMessages();
  app.Chat.ShouldHaveConsumedResponses();
} finally {
  await app.dispose();
}
```

In Vitest, register each successfully started driver for `afterEach` cleanup, as
shown in `test/scenarios/chat/prompt-reply.test.ts`. Startup also cleans up partial setup;
`dispose()` is idempotent. Pair response consumption assertions with transcript
assertions: consuming a scripted action alone does not prove delivery to a client.

## Multiple conversations

```ts
const app = await PiChatDriver.start({ startAtHome: true });
try {
  app.Browser.ShouldBeAtHome();
  const first = await app.Tabs.Create({ responses: [{ prompt: "Hello", reply: "First tab." }] });
  await app.Chat.SendPrompt("Hello");
  await app.Chat.WaitUntilIdle();
  app.Chat.ShouldHaveConsumedResponses();
  const second = await app.Tabs.Create({ responses: [{ prompt: "Hello", reply: "Second tab." }] });
  await app.Chat.SendPrompt("Hello");
  await app.Chat.WaitUntilIdle();
  app.Chat.ShouldHaveConsumedResponses();
  await app.Tabs.SwitchTo(first);
  await app.Browser.Reconnect();
  app.Tabs.ShouldBeActive(first);
  app.Chat.ShouldHaveAssistantReply("First tab.");
  await app.Tabs.Close(second);
  await app.Tabs.Close(first);
  app.Browser.ShouldBeAtHome();
} finally {
  await app.dispose();
}
```

## Implemented slices

- `PiChatDriver.start({ responses?, timeoutMs?, startAtHome?, extensions? })`: a loopback server
  and isolated temporary project with a harness-backed real session factory.
  Default startup opens one session for backward compatibility; `startAtHome: true`
  starts with no sessions. Supply each new conversation's responses to `Tabs.Create`.
- `Chat.SendPrompt(text)`: validates the next domain response script and awaits a
  **new** user message confirming acceptance. Missing/mismatched scripts fail;
  the harness never calls a real model provider.
- `Chat.WaitUntilIdle()`: awaits a fresh idle event for the submitted turn, then
  checks current browser state and fails on runtime errors. Complete this before
  reconnecting or submitting the next prompt in this slice.
- `Chat.ShouldContainMessages(expected)`: ordered containment, not exact equality.
  Pair with `ShouldHaveMessageCount(count)` for an exact transcript.
- `Chat.ShouldHaveAssistantReply(text)`, `ShouldNotHaveAssistantReply(text)`,
  `ShouldHaveNoDuplicateMessages()`, and `ShouldHaveConsumedResponses()` (for
  the active conversation).
- `Chat.Abort()` waits for the active run to settle without a late assistant
  response. Controlled test responses can be held with `hold: true` and released
  through `Chat.ReleaseControlledResponse()`.
- `Browser.Reconnect()`: closes the prior client, creates a fresh client/state,
  waits for all open tab snapshots (or the home catalogue), and checks active identity.
- `Browser.TakeControl()`: opens a second browser connection, waits for its
  authoritative state, and verifies that the previous controller is replaced
  without changing the active conversation.
- `Browser.ShouldBeUsable()` / `ShouldBeAtHome()`: checks connected, loaded state.
- `Tabs.Create({ responses? })`: creates a real isolated session via a correlated
  server command, then waits for its tab and snapshot. Returns an opaque tab handle.
- `Tabs.Active()`, `SwitchTo(tab)`, `Close(tab)`, `ShouldBeActive(tab)`,
  `ShouldContain(tabs)`, and `ShouldHaveCount(count)`. Focus and close await fresh
  acknowledgements, including same-tab focus; closing the last tab awaits a new
  home catalogue. Handles survive reconnect but reject closed/foreign tabs.
  Tab operations must be awaited sequentially.
- `Projects.Browse(path?)`: browses a server folder through the correlated folder
  protocol and returns its validated directory listing.
- `Projects.Open(path?)`: opens a valid server folder as a new conversation and
  waits for its tab and authoritative snapshot. Failed opens reject with the
  recoverable server error without changing the active project.
- `Projects.ShouldRemainAtHome()` and `ShouldBeOpen(path?)`: semantic project
  state assertions.
- `Extensions.RunCommand(name)`: dispatches a registered extension slash command
  and awaits its first fresh prompt, widget, or notification. It does not wait
  for a blocked command to finish; respond to its prompt explicitly.
- `Extensions.WaitForPrompt(title)` returns an opaque handle that survives
  reconnect; `RespondToPrompt(handle, result)` waits for removal. Foreign,
  wrong-conversation, and already-answered handles are rejected.
- `Extensions.WaitForNotification(text, level?)` waits for fresh command output;
  `ShouldShowNotification`, `ShouldShowPrompt`, `ShouldHaveNoPrompts`,
  `ShouldShowWidget`, and `ShouldNotShowWidget` assert browser-projected state.

Inline Pi extension factories are explicit via `start({ extensions: [factory] })`.
Each session independently loads them through the harness's real resource loader.
The adapter binds the actual browser UI; confirmations are answered over the
server protocol, not by the harness's mock UI. See
`test/scenarios/extensions/confirmation.test.ts` and
`test/infra/pi-chat/fixtures/confirmation-extension.ts`. This slice covers
extension commands, not declarative web-extension actions or reload.

Feature drivers share a narrow internal context. The private client validates
protocol schemas and uses the **production browser reducers** to reconstruct the
conversation; assertions do not read the server runtime's message history.
All waits are event-driven and bounded (default 5 seconds), with operation,
predicate, state, close details, and recent messages in diagnostics. No sleeps or
polling are used. Mocked responses pass through real Pi session events and the
real application/server transport. Each session has independent settings,
model-runtime services, history, and scripts within the world's temporary project.
The server and world share idempotent disposal, including already-closed sessions
and in-flight creation. The directory is removed at final cleanup. The current
project catalogue service still reads the normal on-disk catalogue; test sessions
are in-memory and never write to it. React rendering is not exercised here.

## Coverage and commands

```sh
npm ci
npm test
npm test -- test/scenarios
npm test -- test/infra-tests
npm test -- test/modules
```

The default suite includes prompt/reply, reconnect restoration, and repeated
identical prompts before and after reconnect, creation from home, independent
multi-tab transcripts, active/background tab closure, and reconnect/recreation
from home, valid folder browsing/opening, invalid-folder recovery, controlled
active-response abort without transcript corruption, and controller takeover with
conversation restoration, extension confirmation/cancellation, pending-prompt
reconnect, widget restoration, and per-tab extension isolation.
Driver/client/world tests cover script validation,
semantic diagnostics, bounded waits, server rejection, pending-wait cancellation,
failed creation and retry, closed handles, isolated paths, concurrent creation
guards, idempotent disposal, partial-startup cleanup, and cleanup during
in-flight creation.

Latest verification: 73 test files / 497 tests passed with `--maxWorkers=4`;
build/typecheck passed with the root Pi SDK dependencies at 1.0.2.

## Harness setup

The dev dependency is pinned to the ManuelSelch harness fork at commit
`7ade82c6c7de2ae85f69df1c442a515b63c6dadc`. `npm ci` installs it directly
from GitHub; no local checkout or tarball is required. Git/network access and
the fork's `prepare` install script are needed to build its exported JavaScript.
Root Pi SDK dependencies are pinned to 1.0.2 in `package.json`/`package-lock.json`.

`TestSession.prepare(...turns)` installs model playbooks without sending prompts.
The drivers submit prompts through Pi Chat and assert response consumption.
`PiRuntimeAdapter.fromRuntime(runtime)` attaches to the harness-initialized session
without another extension startup event and owns runtime disposal. Each runtime
uses its session's model runtime, settings, and resource loader.

The standalone compatibility spike was removed because prompt/reply and reconnect
are covered by the normal scenarios. Run `npm test -- test/scenarios` instead.

## Next slice

The core multi-session, project selection/error, and extension confirmation UI
slices are covered. Persisted `Tabs.Open()`, controlled active-turn reconnect,
and broader extension actions/reload remain. Continuing/reopening persisted sessions
and replacing a runtime explicitly reject unsupported operations rather than
falling back to production settings or providers. Folder workflows currently
allow the world's isolated project only; arbitrary external folders are still
rejected by the test factory.

Next: controlled active-turn reconnect or persisted-session reopening; see
[REQUIREMENTS.md](REQUIREMENTS.md) for the broader plan.
