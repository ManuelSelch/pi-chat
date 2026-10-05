import { afterEach, describe, expect, it } from "vitest";
import { PiChatDriver } from "../../infra/pi-chat/pi-chat-driver.js";

const apps: PiChatDriver[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.dispose();
  }
});

describe("Pi Chat persisted tab workflows", () => {
  it("reopens a closed persisted session with its transcript", async () => {
    const app = await PiChatDriver.start({
      responses: [{ prompt: "Remember this", reply: "Saved conversation." }],
    });
    apps.push(app);

    const tab = app.Tabs.Active();
    await app.Chat.SendPrompt("Remember this");
    await app.Chat.WaitUntilIdle();

    const sessionPath = app.Tabs.SessionPath(tab);
    await app.Tabs.Close(tab);
    app.Browser.ShouldBeAtHome();

    const reopened = await app.Tabs.Open(sessionPath);

    app.Tabs.ShouldBeActive(reopened);
    app.Chat.ShouldContainMessages([
      { role: "user", text: "Remember this" },
      { role: "assistant", text: "Saved conversation." },
    ]);
    app.Chat.ShouldHaveMessageCount(2);
    app.Chat.ShouldHaveNoDuplicateMessages();
  }, 15000);

  it("rejects a missing persisted session without opening a tab", async () => {
    const app = await PiChatDriver.start({ startAtHome: true });
    apps.push(app);

    await expect(
      app.Tabs.Open("/definitely/missing/pi-chat-session.jsonl"),
    ).rejects.toThrow();

    app.Browser.ShouldBeAtHome();
    app.Tabs.ShouldHaveCount(0);
  }, 15000);
});
