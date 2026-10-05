import { afterEach, describe, it } from "vitest";
import { PiChatDriver } from "../../support/pi-chat/pi-chat-driver.js";

const apps: PiChatDriver[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.dispose();
  }
});

async function start(responses: { prompt: string; reply: string }[]) {
  const app = await PiChatDriver.start({ responses });
  apps.push(app);
  return app;
}

describe("Pi Chat prompt/reply workflows", () => {
  it("sends a prompt and displays the assistant reply", async () => {
    const app = await start([
      { prompt: "Hello", reply: "Hello from Pi Chat." },
    ]);

    app.Browser.ShouldBeUsable();

    await app.Chat.SendPrompt("Hello");
    await app.Chat.WaitUntilIdle();

    app.Chat.ShouldHaveAssistantReply("Hello from Pi Chat.");
    app.Chat.ShouldContainMessages([
      { role: "user", text: "Hello" },
      { role: "assistant", text: "Hello from Pi Chat." },
    ]);
    app.Chat.ShouldHaveMessageCount(2);
    app.Chat.ShouldHaveConsumedResponses();
  });

});
