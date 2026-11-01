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

describe("Pi Chat browser reconnect workflows", () => {
  it("reconnects and restores the current conversation without duplicates", async () => {
    const app = await start([
      { prompt: "Remember this", reply: "Remembered." },
    ]);

    await app.chat.sendPrompt("Remember this");
    await app.chat.waitUntilIdle();

    await app.browser.reconnect();

    app.browser.shouldBeUsable();
    app.chat.shouldContainMessages([
      { role: "user", text: "Remember this" },
      { role: "assistant", text: "Remembered." },
    ]);
    app.chat.shouldHaveMessageCount(2);
    app.chat.shouldHaveNoDuplicateMessages();
    app.chat.shouldHaveConsumedResponses();
  });

  it("waits for a fresh reply on repeated prompts, including after reconnect", async () => {
    const app = await start([
      { prompt: "Again", reply: "First reply." },
      { prompt: "Again", reply: "Second reply." },
      { prompt: "Again", reply: "Third reply." },
    ]);

    await app.chat.sendPrompt("Again");
    await app.chat.waitUntilIdle();

    await app.chat.sendPrompt("Again");
    await app.chat.waitUntilIdle();
    app.chat.shouldHaveAssistantReply("Second reply.");

    await app.browser.reconnect();

    await app.chat.sendPrompt("Again");
    await app.chat.waitUntilIdle();

    app.chat.shouldContainMessages([
      { role: "user", text: "Again" },
      { role: "assistant", text: "First reply." },
      { role: "user", text: "Again" },
      { role: "assistant", text: "Second reply." },
      { role: "user", text: "Again" },
      { role: "assistant", text: "Third reply." },
    ]);
    app.chat.shouldHaveMessageCount(6);
    app.chat.shouldHaveNoDuplicateMessages();
    app.chat.shouldHaveConsumedResponses();
  });
});
