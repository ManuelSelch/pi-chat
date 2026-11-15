import { afterEach, describe, it } from "vitest";
import { PiChatDriver } from "../../infra/pi-chat/pi-chat-driver.js";

const apps: PiChatDriver[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.dispose()));
});

describe("Pi Chat multiple browser workflows", () => {
  it("keeps both browsers connected and shares conversation updates", async () => {
    const app = await PiChatDriver.start({
      responses: [{ prompt: "Remember this", reply: "Still here." }, { prompt: "Hello again", reply: "Both see this." }],
    });
    apps.push(app);

    await app.chat.sendPrompt("Remember this");
    await app.chat.waitUntilIdle();

    await app.browser.openSecondBrowser();

    app.browser.shouldBeUsable();
    app.chat.shouldContainMessages([
      { role: "user", text: "Remember this" },
      { role: "assistant", text: "Still here." },
    ]);
    app.chat.shouldHaveMessageCount(2);
    app.chat.shouldHaveNoDuplicateMessages();

    await app.chat.sendPrompt("Hello again");
    await app.chat.waitUntilIdle();
    app.browser.switchBrowser();
    app.browser.shouldBeUsable();
    await app.chat.waitForAssistantReply("Both see this.");
    app.chat.shouldHaveMessageCount(4);
    app.chat.shouldHaveNoDuplicateMessages();
  });
});
