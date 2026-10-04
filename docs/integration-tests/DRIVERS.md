# Pi Chat integration drivers

`test/support/pi-chat/pi-chat-driver.ts` is the test-only application root. Use
ordinary imperative TypeScript workflows, with the driver named `app`:

```ts
import { PiChatDriver } from "../../test/support/pi-chat/pi-chat-driver.js";

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
shown in `test/pi-chat-integration.test.ts`. Startup also cleans up partial setup;
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

- `PiChatDriver.start({ responses?, timeoutMs?, startAtHome? })`: a loopback server
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
- `Chat.ShouldHaveAssistantReply(text)`, `ShouldHaveNoDuplicateMessages()`, and
  `ShouldHaveConsumedResponses()` (for the active conversation).
- `Browser.Reconnect()`: closes the prior client, creates a fresh client/state,
  waits for all open tab snapshots (or the home catalogue), and checks active identity.
- `Browser.ShouldBeUsable()` / `ShouldBeAtHome()`: checks connected, loaded state.
- `Tabs.Create({ responses? })`: creates a real isolated session via a correlated
  server command, then waits for its tab and snapshot. Returns an opaque tab handle.
- `Tabs.Active()`, `SwitchTo(tab)`, `Close(tab)`, `ShouldBeActive(tab)`,
  `ShouldContain(tabs)`, and `ShouldHaveCount(count)`. Focus and close await fresh
  acknowledgements, including same-tab focus; closing the last tab awaits a new
  home catalogue. Handles survive reconnect but reject closed/foreign tabs.
  Tab operations must be awaited sequentially.

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
npm test -- test/pi-chat-integration.test.ts test/pi-chat-tabs.test.ts
npm run test:spike
```

The default suite includes prompt/reply, reconnect restoration, and repeated
identical prompts before and after reconnect, creation from home, independent
multi-tab transcripts, active/background tab closure, and reconnect/recreation
from home. Driver/client/world tests cover script validation, semantic diagnostics,
bounded waits, server rejection, pending-wait cancellation, failed creation and
retry, closed handles, isolated paths, concurrent creation guards, idempotent
disposal, partial-startup cleanup, and cleanup during in-flight creation.

Latest verification: 58 test files / 424 tests passed; build/typecheck and spike passed.

The standalone spike now delegates to the same driver, rather than duplicating
setup or low-level WebSocket code. Its dependency/build details are in [SPIKE.md](SPIKE.md).

## Next slice

The core multi-session milestone is covered. `Projects`, `Extensions`, abort,
controller takeover, persisted `Tabs.Open()`, and controlled active-turn reconnect
are not covered yet. Continuing/reopening persisted sessions and replacing a
runtime explicitly reject unsupported operations rather than falling back to
production settings or providers. Tab creation currently uses the world's
isolated default project, not arbitrary external folders.

Next: project selection/error flows or controlled streaming/abort scenarios; see
[REQUIREMENTS.md](REQUIREMENTS.md) for the broader plan.
