import { afterEach, describe, it } from "vitest";
import { PiChatDriver } from "../../infra/pi-chat/pi-chat-driver.js";

const apps: PiChatDriver[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.dispose();
  }
});

describe("Pi Chat active-turn reconnect workflows", () => {
  it("rebuilds a live conversation after reconnect and completes once", async () => {
    const app = await PiChatDriver.start({
      responses: [{ prompt: "Continue working", reply: "Finished after reconnect.", hold: true }],
    });
    apps.push(app);

    await app.chat.sendPrompt("Continue working");
    await app.chat.waitUntilStreaming();

    await app.browser.reconnect();

    app.browser.shouldBeUsable();
    app.chat.shouldContainMessages([
      { role: "user", text: "Continue working" },
    ]);

    app.chat.releaseControlledResponse();
    await app.chat.waitUntilIdle();

    app.chat.shouldHaveAssistantReply("Finished after reconnect.");
    app.chat.shouldHaveMessageCount(2);
    app.chat.shouldHaveNoDuplicateMessages();
  }, 15000);
});
