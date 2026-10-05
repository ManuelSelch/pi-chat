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

    await app.Chat.SendPrompt("Continue working");
    await app.Chat.WaitUntilStreaming();

    await app.Browser.Reconnect();

    app.Browser.ShouldBeUsable();
    app.Chat.ShouldContainMessages([
      { role: "user", text: "Continue working" },
    ]);

    app.Chat.ReleaseControlledResponse();
    await app.Chat.WaitUntilIdle();

    app.Chat.ShouldHaveAssistantReply("Finished after reconnect.");
    app.Chat.ShouldHaveMessageCount(2);
    app.Chat.ShouldHaveNoDuplicateMessages();
  }, 15000);
});
