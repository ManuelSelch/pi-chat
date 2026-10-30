import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page);
  await app.Browser.SetViewport(1024);
});
test.afterEach(async () => { await app.dispose(); });

test("fresh browsers default to sidebar sessions without header branding", async () => {
  await app.Inbox.shouldUseMode(true);
  await app.Inbox.shouldHaveUnbrandedHeader();
  await app.Inbox.shouldShowHome();

  await app.Inbox.create();

  await app.Inbox.shouldHaveUnbrandedHeader();
});

test("running sessions hide header pause and archive actions until completion", async () => {
  await app.Inbox.setEnabled(true);
  await app.Inbox.create({ responses: [
    { prompt: "Header actions", reply: "Saved response" },
    { prompt: "Keep working", reply: "Finished", hold: true },
  ] });
  await app.Chat.SendPrompt("Header actions");
  await app.Chat.ShouldShowAssistantReply("Saved response");
  await app.Inbox.setEnabled(true);
  await app.Inbox.shouldHaveHeaderSessionActions(true);

  await app.Chat.SendPrompt("Keep working");
  await app.Inbox.shouldBeInSection("Header actions", "Working");

  await app.Inbox.shouldHaveHeaderSessionActions(false);
  await app.Inbox.shouldHideRunningActions("Header actions");

  await app.Inbox.finishResponse("Header actions");

  await app.Chat.ShouldShowAssistantReply("Finished");
  await app.Inbox.shouldHaveHeaderSessionActions(true);
});

test("explicit sidebar preferences survive reload in either direction", async () => {
  await app.Inbox.setEnabled(false);

  await app.Inbox.reload(false);

  await app.Inbox.shouldUseMode(false);
  await app.Inbox.shouldShowHome();

  await app.Inbox.setEnabled(true);

  await app.Inbox.reload();

  await app.Inbox.shouldUseMode(true);
  await app.Inbox.shouldShowHome();
});
