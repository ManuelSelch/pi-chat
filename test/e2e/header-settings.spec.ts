import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page);
  await app.browser.setViewport(1024);
});
test.afterEach(async () => { await app.dispose(); });

test("fresh browsers default to sidebar sessions without header branding", async () => {
  await app.inbox.shouldUseMode(true);
  await app.inbox.shouldHaveUnbrandedHeader();
  await app.inbox.shouldShowHome();

  await app.inbox.create();

  await app.inbox.shouldHaveUnbrandedHeader();
});

test("running sessions hide header pause and archive actions until completion", async () => {
  await app.inbox.setEnabled(true);
  await app.inbox.create({ responses: [
    { prompt: "Header actions", reply: "Saved response" },
    { prompt: "Keep working", reply: "Finished", hold: true },
  ] });
  await app.chat.sendPrompt("Header actions");
  await app.chat.shouldShowAssistantReply("Saved response");
  await app.inbox.setEnabled(true);
  await app.inbox.shouldHaveHeaderSessionActions(true);

  await app.chat.sendPrompt("Keep working");
  await app.inbox.shouldBeInSection("Header actions", "Working");

  await app.inbox.shouldHaveHeaderSessionActions(false);
  await app.inbox.shouldHideRunningActions("Header actions");

  await app.inbox.finishResponse("Header actions");

  await app.chat.shouldShowAssistantReply("Finished");
  await app.inbox.shouldHaveHeaderSessionActions(true);
});

test("explicit sidebar preferences survive reload in either direction", async () => {
  await app.inbox.setEnabled(false);

  await app.inbox.reload(false);

  await app.inbox.shouldUseMode(false);
  await app.inbox.shouldShowHome();

  await app.inbox.setEnabled(true);

  await app.inbox.reload();

  await app.inbox.shouldUseMode(true);
  await app.inbox.shouldShowHome();
});
