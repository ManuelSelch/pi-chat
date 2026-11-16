import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, { inboxEnabled: false });
});

test.afterEach(async () => {
  await app.dispose();
});

test("hides archived sessions by default and persists opting back into Archived after reload", async () => {
  await app.settings.open();
  await app.settings.shouldHideArchivedSessions(true);
  await app.settings.close();
  const remaining = await app.tabs.create({ responses: [{ prompt: "Keep this conversation", reply: "Still open" }] });
  await app.chat.sendPrompt("Keep this conversation");
  await app.chat.shouldShowAssistantReply("Still open");
  await app.chat.shouldBeIdle();

  await app.tabs.create({ responses: [{ prompt: "Archive this conversation", reply: "Ready to archive" }] });
  await app.chat.sendPrompt("Archive this conversation");
  await app.chat.shouldShowAssistantReply("Ready to archive");
  await app.chat.shouldBeIdle();

  await app.projects.open();
  await app.projects.shouldShowActiveSession("Archive this conversation");
  await app.projects.archive("Archive this conversation");
  await app.projects.shouldNotShowSession("Archive this conversation");
  await app.projects.shouldHideArchivedSection();
  await app.projects.close();
  await app.home.shouldBeVisible();

  await app.tabs.switchTo(remaining);
  await app.settings.open();
  await app.settings.setHideArchivedSessions(false);
  await app.settings.close();
  await app.projects.open();
  await app.projects.showArchivedSessions();
  await app.projects.shouldShowArchivedSession("Archive this conversation");
  await app.projects.shouldShowActiveSession("Keep this conversation");
  await app.projects.close();
  await app.tabs.shouldHaveCount(1);
  await app.chat.shouldShowAssistantReply("Still open");

  await app.browser.reload();
  await app.settings.open();
  await app.settings.shouldHideArchivedSessions(false);
  await app.settings.close();

  await app.projects.open();
  await app.projects.shouldNotShowSession("Archive this conversation");
  await app.projects.showArchivedSessions();
  await app.projects.shouldShowArchivedSession("Archive this conversation");
  await app.projects.shouldShowActiveSession("Keep this conversation");
  await app.projects.close();

  await app.settings.open();
  await app.settings.setHideArchivedSessions(true);
  await app.settings.close();
  await app.projects.open();
  await app.projects.shouldHideArchivedSection();
  await app.projects.shouldNotShowSession("Archive this conversation");
  await app.projects.shouldShowActiveSession("Keep this conversation");
});
