import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, { storedPreferences: { "pi-chat:session-inbox": false, "pi-chat:displayPath": true, "pi-chat:hideArchivedSessions": false } });
  await app.browser.setViewport(1024);
});
test.afterEach(async () => { await app.dispose(); });

test("fresh browsers default to sidebar sessions without header branding", async () => {
  await app.inbox.shouldUseSidebar();
  await app.inbox.shouldHaveUnbrandedHeader();
  await app.inbox.shouldShowHome();

  await app.inbox.create();

  await app.inbox.shouldHaveUnbrandedHeader();
});

test("running sessions hide header pause and archive actions until completion", async () => {
  await app.inbox.create({ responses: [
    { prompt: "Header actions", reply: "Saved response" },
    { prompt: "Keep working", reply: "Finished", hold: true },
  ] });
  await app.chat.sendPrompt("Header actions");
  await app.chat.shouldShowAssistantReply("Saved response");
  await app.inbox.shouldHaveHeaderSessionActions(true);

  await app.chat.sendPrompt("Keep working");
  await app.inbox.shouldHaveStatusCount("Working", 1);
  await app.inbox.shouldHaveStatus("Header actions", "Working");

  await app.inbox.shouldHaveHeaderSessionActions(false);
  await app.inbox.shouldHideRunningActions("Header actions");

  await app.inbox.finishResponse("Header actions");

  await app.chat.shouldShowAssistantReply("Finished");
  await app.inbox.shouldHaveHeaderSessionActions(true);
});

test("retired sidebar preferences cannot restore tabs after reload", async () => {
  await app.inbox.reload();

  await app.inbox.shouldUseSidebar();
  await app.inbox.shouldShowHome();
  await app.settings.open();
  await app.settings.shouldOmitRetiredPreferences();
  await app.settings.shouldOmitSessionControls();
});
