import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, { storedPreferences: { "pi-chat:hideArchivedSessions": false } });
});
test.afterEach(async () => { await app.dispose(); });

test("archived sessions stay hidden after reload despite a retired preference", async () => {
  await app.sessions.create({ responses: [{ prompt: "Keep this conversation", reply: "Still open" }] });
  await app.chat.sendPrompt("Keep this conversation");
  await app.chat.shouldShowAssistantReply("Still open");
  await app.sessions.create({ responses: [{ prompt: "Archive this conversation", reply: "Ready to archive" }] });
  await app.chat.sendPrompt("Archive this conversation");
  await app.chat.shouldShowAssistantReply("Ready to archive");
  await app.chat.shouldBeIdle();

  await app.inbox.archiveCurrent();

  await app.inbox.shouldShowHome();
  await app.inbox.shouldNotShowSession("Archive this conversation");
  await app.inbox.shouldHaveStatus("Keep this conversation", "Ready");

  await app.inbox.reload();

  await app.inbox.shouldNotShowSession("Archive this conversation");
  await app.inbox.shouldHaveStatus("Keep this conversation", "Ready");
  await app.quickOpen.open();
  await app.quickOpen.shouldNotShowSession("Archive this conversation");
  await app.quickOpen.shouldShowSessionOnce("Keep this conversation");
});
