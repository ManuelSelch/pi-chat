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

    await app.Chat.SendPrompt("Keep working");
    await app.Chat.Abort();

    app.Chat.ShouldHaveMessageCount(1);
    app.Chat.ShouldContainMessages([
      { role: "user", text: "Keep working" },
    ]);
    app.Chat.ShouldNotHaveAssistantReply("Late response");

    app.Chat.ReleaseControlledResponse();
    await app.Browser.Reconnect();

    app.Chat.ShouldHaveMessageCount(1);
    app.Chat.ShouldHaveNoDuplicateMessages();
  });
});
