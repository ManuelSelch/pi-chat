/** Run with: npm run test:spike
 * Uses the same real-Pi domain driver as the normal Vitest workflows.
 */
import { PiChatDriver } from "../../test/support/pi-chat/pi-chat-driver.js";

const app = await PiChatDriver.start({
  responses: [{ prompt: "Hello", reply: "Hello from the real Pi runtime." }],
});
try {
  await app.Chat.SendPrompt("Hello");
  await app.Chat.WaitUntilIdle();
  app.Chat.ShouldHaveAssistantReply("Hello from the real Pi runtime.");
  app.Chat.ShouldHaveConsumedResponses();
  await app.Browser.Reconnect();
  app.Browser.ShouldBeUsable();
  app.Chat.ShouldContainMessages([
    { role: "user", text: "Hello" },
    { role: "assistant", text: "Hello from the real Pi runtime." },
  ]);
  app.Chat.ShouldHaveMessageCount(2);
  app.Chat.ShouldHaveNoDuplicateMessages();
  console.log("PASS: fork → real Pi session → PiRuntimeAdapter → Pi Chat WebSocket prompt/reply and reconnect");
} finally {
  await app.dispose();
}
