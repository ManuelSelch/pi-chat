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

    const tab = app.tabs.active();
    await app.chat.sendPrompt("Remember this");
    await app.chat.waitUntilIdle();

    const sessionPath = app.tabs.sessionPath(tab);
    await app.tabs.close(tab);
    app.browser.shouldBeAtHome();

    const reopened = await app.tabs.open(sessionPath);

    app.tabs.shouldBeActive(reopened);
    app.chat.shouldContainMessages([
      { role: "user", text: "Remember this" },
      { role: "assistant", text: "Saved conversation." },
    ]);
    app.chat.shouldHaveMessageCount(2);
    app.chat.shouldHaveNoDuplicateMessages();
  }, 15000);

  it("rejects a missing persisted session without opening a tab", async () => {
    const app = await PiChatDriver.start({ startAtHome: true });
    apps.push(app);

    await expect(
      app.tabs.open("/definitely/missing/pi-chat-session.jsonl"),
    ).rejects.toThrow();

    app.browser.shouldShowError("The server operation failed.");
    app.browser.dismissError();
    app.browser.shouldBeAtHome();
    app.tabs.shouldHaveCount(0);
  }, 15000);
});
