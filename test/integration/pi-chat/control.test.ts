import { afterEach, describe, it } from "vitest";
import { PiChatDriver } from "../../support/pi-chat/pi-chat-driver.js";

const apps: PiChatDriver[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.dispose()));
});

describe("Pi Chat controller workflows", () => {
  it("takes control with a second browser connection and restores the conversation", async () => {
    const app = await PiChatDriver.start({
      responses: [{ prompt: "Remember this", reply: "Still here." }],
    });
    apps.push(app);

    await app.Chat.SendPrompt("Remember this");
    await app.Chat.WaitUntilIdle();

    await app.Browser.TakeControl();

    app.Browser.ShouldBeUsable();
    app.Chat.ShouldContainMessages([
      { role: "user", text: "Remember this" },
      { role: "assistant", text: "Still here." },
    ]);
    app.Chat.ShouldHaveMessageCount(2);
    app.Chat.ShouldHaveNoDuplicateMessages();
  });
});
