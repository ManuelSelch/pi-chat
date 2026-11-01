import { afterEach, describe, it } from "vitest";
import { PiChatDriver } from "../../infra/pi-chat/pi-chat-driver.js";

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

    app.browser.shouldBeUsable();

    await app.chat.sendPrompt("Hello");
    await app.chat.waitUntilIdle();

    app.chat.shouldHaveAssistantReply("Hello from Pi Chat.");
    app.chat.shouldContainMessages([
      { role: "user", text: "Hello" },
      { role: "assistant", text: "Hello from Pi Chat." },
    ]);
    app.chat.shouldHaveMessageCount(2);
    app.chat.shouldHaveConsumedResponses();
  });

});
