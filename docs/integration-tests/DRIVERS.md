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

## Implemented slice

- `PiChatDriver.start({ responses?, timeoutMs? })`: one harness-backed real Pi
  session and runtime, a loopback server on an ephemeral port, and a private client.
- `Chat.SendPrompt(text)`: validates the next domain response script and awaits a
  **new** user message confirming acceptance. Missing/mismatched scripts fail;
  the harness never calls a real model provider.
- `Chat.WaitUntilIdle()`: awaits a fresh idle event for the submitted turn, then
  checks current browser state and fails on runtime errors. Complete this before
  reconnecting or submitting the next prompt in this slice.
- `Chat.ShouldContainMessages(expected)`: ordered containment, not exact equality.
  Pair with `ShouldHaveMessageCount(count)` for an exact transcript.
- `Chat.ShouldHaveAssistantReply(text)`, `ShouldHaveNoDuplicateMessages()`, and
  `ShouldHaveConsumedResponses()`.
- `Browser.Reconnect()`: closes the prior client, creates a fresh client/state,
  waits for the active tab and authoritative snapshot, and checks session identity.
- `Browser.ShouldBeUsable()`: checks connected state and an active loaded session.

Feature drivers share a narrow internal context. The private client validates
protocol schemas and uses the **production browser reducers** to reconstruct the
conversation; assertions do not read the server runtime's message history.
All waits are event-driven and bounded (default 5 seconds), with operation,
predicate, state, close details, and recent messages in diagnostics. No sleeps or
polling are used. Mocked responses pass through real Pi session events and the
real application/server transport. React rendering is not exercised here.

## Coverage and commands

```sh
npm ci
npm test
npm test -- test/pi-chat-integration.test.ts
npm run test:spike
```

The default suite includes prompt/reply, reconnect restoration, and repeated
identical prompts before and after reconnect. Driver/client tests cover script
validation, semantic diagnostics, bounded waits, server rejection, pending-wait
cancellation, repeated disposal, and partial-startup cleanup.

The standalone spike now delegates to the same driver, rather than duplicating
setup or low-level WebSocket code. Its dependency/build details are in [SPIKE.md](SPIKE.md).

## Next slice

`Tabs`, `Projects`, `Extensions`, abort, controller takeover, and reconnect during
an active turn are not implemented yet. The current world starts with one loaded
conversation, not at home. Session creation/replacement factories explicitly
reject unsupported operations instead of using production settings or providers.

Next: add a harness-backed runtime factory for isolated real session creation,
then `Tabs.Create()`, `SwitchTo()`, and `Close()` workflows with independent
transcripts. The larger first milestone in [REQUIREMENTS.md](REQUIREMENTS.md)
remains open until those scenarios are covered.
