import { afterEach, describe, it } from "vitest";
import { PiChatDriver } from "../../support/pi-chat/pi-chat-driver.js";

const apps: PiChatDriver[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.dispose();
});

async function start(responses: { prompt: string; reply: string }[]) {
  const app = await PiChatDriver.start({ responses });
  apps.push(app);
  return app;
}

describe("Pi Chat user workflows with real Pi", () => {
  it("sends a prompt and displays the assistant reply", async () => {
    const app = await start([{ prompt: "Hello", reply: "Hello from Pi Chat." }]);
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

  it("reconnects and restores the current conversation without duplicates", async () => {
    const app = await start([{ prompt: "Remember this", reply: "Remembered." }]);
    await app.Chat.SendPrompt("Remember this");
    await app.Chat.WaitUntilIdle();
    await app.Browser.Reconnect();
    app.Browser.ShouldBeUsable();
    app.Chat.ShouldContainMessages([
      { role: "user", text: "Remember this" },
      { role: "assistant", text: "Remembered." },
    ]);
    app.Chat.ShouldHaveMessageCount(2);
    app.Chat.ShouldHaveNoDuplicateMessages();
    app.Chat.ShouldHaveConsumedResponses();
  });

  it("waits for a fresh reply on repeated prompts, including after reconnect", async () => {
    const app = await start([
      { prompt: "Again", reply: "First reply." },
      { prompt: "Again", reply: "Second reply." },
      { prompt: "Again", reply: "Third reply." },
    ]);
    await app.Chat.SendPrompt("Again");
    await app.Chat.WaitUntilIdle();
    await app.Chat.SendPrompt("Again");
    await app.Chat.WaitUntilIdle();
    app.Chat.ShouldHaveAssistantReply("Second reply.");
    await app.Browser.Reconnect();
    await app.Chat.SendPrompt("Again");
    await app.Chat.WaitUntilIdle();
    app.Chat.ShouldContainMessages([
      { role: "user", text: "Again" },
      { role: "assistant", text: "First reply." },
      { role: "user", text: "Again" },
      { role: "assistant", text: "Second reply." },
      { role: "user", text: "Again" },
      { role: "assistant", text: "Third reply." },
    ]);
    app.Chat.ShouldHaveMessageCount(6);
    app.Chat.ShouldHaveNoDuplicateMessages();
    app.Chat.ShouldHaveConsumedResponses();
  });
});
