import { afterEach, describe, it } from "vitest";
import { PiChatDriver } from "../../infra/pi-chat/pi-chat-driver.js";

const apps: PiChatDriver[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.dispose()));
});

describe("Pi Chat streaming workflows", () => {
  it("aborts a controlled active response without corrupting the transcript", async () => {
    const app = await PiChatDriver.start({
      responses: [{ prompt: "Keep working", reply: "Late response", hold: true }],
    });
    apps.push(app);

    await app.chat.sendPrompt("Keep working");
    await app.chat.abort();

    app.chat.shouldHaveMessageCount(1);
    app.chat.shouldContainMessages([
      { role: "user", text: "Keep working" },
    ]);
    app.chat.shouldNotHaveAssistantReply("Late response");

    app.chat.releaseControlledResponse();
    await app.browser.reconnect();

    app.chat.shouldHaveMessageCount(1);
    app.chat.shouldHaveNoDuplicateMessages();
  });
});
