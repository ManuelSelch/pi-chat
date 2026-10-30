# Application drivers

Scenarios express outcomes through product-language drivers, not sockets,
selectors or arbitrary waits. [Test placement](../../test/README.md) separates
module/DOM tests, non-rendered application scenarios, browser workflows and
support-infrastructure tests. Choose the lowest boundary that faithfully proves
the outcome: protocol projections cannot prove focus, geometry or rendering.

## Non-rendered application driver

[PiChatDriver](../../test/infra/pi-chat/pi-chat-driver.ts) starts an embedded
public server, harness-backed real Pi sessions and a WebSocket client using
`PiClient` plus the production `bindPiChat`/application-state binding. It does
not render React or implement another wire-session reducer. Only model replies
are scripted; messages flow through Pi/runtime/server/SDK machinery.

```ts
import { afterEach, it } from "vitest";
import { PiChatDriver } from "../../infra/pi-chat/pi-chat-driver.js";

let app: PiChatDriver | undefined;
afterEach(async () => { await app?.dispose(); app = undefined; });

it("retains the conversation after reconnect", async () => {
  app = await PiChatDriver.start({
    responses: [{ prompt: "Hello", reply: "Hello from Pi Chat." }],
  });

  await app.Chat.SendPrompt("Hello");
  await app.Chat.WaitUntilIdle();
  await app.Browser.Reconnect();

  app.Browser.ShouldBeUsable();
  app.Chat.ShouldContainMessages([
    { role: "user", text: "Hello" },
    { role: "assistant", text: "Hello from Pi Chat." },
  ]);
  app.Chat.ShouldHaveMessageCount(2);
  app.Chat.ShouldHaveNoDuplicateMessages();
  app.Chat.ShouldHaveConsumedResponses();
});
```

This example uses the relative import depth of
[`test/scenarios/browser/reconnect.test.ts`](../../test/scenarios/browser/reconnect.test.ts).
Register successfully created drivers for cleanup; `start()` cleans partial
startup and `dispose()` is idempotent. Keep setup, action and assertion phases
readable. Consuming a scripted response alone does not prove it reached a client.

### Driver surfaces

| Driver | Current operations / assertions |
|---|---|
| `Chat` | Send prompt, steer, wait for streaming/idle, release held response, abort; assert ordered history, exact counts, replies, queue and consumed responses |
| `Browser` | Reconnect, take control; assert usable/Home state |
| `Tabs` | Create, switch, close, open persisted history, obtain saved path; assert active handle/membership/count |
| `Projects` | Browse/open server folders; assert current project or retained Home |
| `Extensions` | Run registered extension commands, wait/respond to opaque prompt handles, observe notifications/widgets and prompt removal |

- `start({ startAtHome: true })` starts with no conversation. Otherwise one
  conversation is created. Supply each new session's response script through
  `Tabs.Create({ responses })`, not shared global state.
- `SendPrompt` validates the next script and waits for a fresh consumed user
  message, not just admission. `WaitUntilIdle` checks fresh settlement on the
  same connection, or authoritative current state after reconnect.
- `ShouldContainMessages` is ordered containment, not equality. Pair with exact
  count and duplicate checks where the contract requires an exact transcript.
- `{ hold: true }` provides deterministic control of a model response. Use
  `WaitUntilStreaming` and `ReleaseControlledResponse`, not timing-only sleeps.
- Tab operations must be awaited serially. Opaque handles reject foreign/closed
  identities; saved-history reopening restores a new runtime identity.
- Reconnect creates a fresh client/projection rather than trusting cached
  transcript data. Take-control tests verify the previous controller closes.
- `Extensions.RunCommand` waits for first fresh visible UI output, not completion
  of a blocked command. Answer prompts explicitly; prompt handles enforce
  conversation ownership and cannot be reused after settlement.
- Feature drivers share a narrow private context. Bounded event-driven waits
  include operation/state/recent-message diagnostics; no silent no-op assertions.

### Isolation and limits

[TestWorld](../../test/infra/pi-chat/test-world.ts) owns temporary project/history,
per-session settings/resources/model scripts and cleanup, including in-flight
creation. Opening persisted sessions is restricted to its session directory.
Continuing a persisted project and runtime replacement explicitly throw as
unsupported; do not interpret them as tested or fall back to personal providers.
The non-rendered driver's server does not inject a private catalogue lister/store,
so its default catalogue can read normal on-disk metadata. It is not the boundary
for destructive archive/pin tests. Use the browser world's private catalogue for
those operations.

## Real browser driver

[PiChatBrowserDriver](../../test/infra/e2e/pi-chat-browser-driver.ts) drives the
built frontend in Chromium against an ephemeral loopback server and real Pi
sessions with scripted model responses. Its catalogue/history/archive metadata
are test-owned. It composes feature drivers for Chat, Tabs, Home, Projects, Inbox,
Settings, Focus, Prompts, Widgets, Theme, Skills and Extensions. Locators, retrying
assertions, viewport and reload mechanics stay in these drivers.

Browser scenarios import [coverage fixtures](../../test/infra/e2e/coverage/fixtures.ts)
so optional coverage attaches before navigation and flushes before teardown.
Browser-only resources such as fixture skills are installed per session through
`Tabs.Create` options; response `readSkill` uses the actual read tool. New page
navigation must checkpoint coverage; extra pages/popups are not collected by the
current coverage collector. Do not infer popup coverage from a successful link
opening assertion.

## Existing executable contracts

- [Prompt/reply](../../test/scenarios/chat/prompt-reply.test.ts),
  [steering](../../test/scenarios/chat/steering.test.ts),
  [active-turn reconnect](../../test/scenarios/browser/active-turn-reconnect.test.ts),
  [takeover](../../test/scenarios/browser/takeover.test.ts) and
  [persisted reopening](../../test/scenarios/tabs/persisted-open.test.ts).
- [Project archive](../../test/e2e/project-archive.spec.ts),
  [pinning](../../test/e2e/project-pin.spec.ts),
  [responsive Projects](../../test/e2e/projects-sidebar.spec.ts),
  [Inbox](../../test/e2e/session-inbox.spec.ts) and
  [worktree labels](../../test/e2e/inbox-worktree-labels.spec.ts).
- [Focus](../../test/e2e/composer-focus.spec.ts),
  [endpoint recovery](../../test/e2e/server-endpoint.spec.ts),
  [rich prompts](../../test/e2e/prompt-presentation.spec.ts),
  [widgets](../../test/e2e/widgets.spec.ts), [themes](../../test/e2e/theme.spec.ts)
  and [skills](../../test/e2e/skills.spec.ts).

These links identify maintained contract locations, not a claim that every
legacy requirement is covered or that the suites passed at this revision.
Server/SDK internals and Swift compatibility tests belong to their repositories.

## Setup and commands

Follow [development setup](../development.md#local-workflow): install with
lifecycle scripts disabled and explicitly compile the pinned source-only harness.
Do not enable automatic dependency scripts just to build that Git dependency.
The manifest/lockfile identify the harness revision; no local checkout is needed.

```sh
npm test -- test/scenarios
npm test -- test/infra-tests
npm test -- test/modules
npm run build
npx playwright test test/e2e/project-archive.spec.ts test/e2e/project-pin.spec.ts
```

Browser tests require Chromium. Run shared-build-output workflows serially; see
[coverage and CI](../development.md#e2e-coverage) and
[focus assertion discipline](../../test/README.md#composer-focus-regressions).
