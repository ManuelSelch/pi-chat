import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, { inboxEnabled: false });
});

test.afterEach(async () => {
  await app.dispose();
});

test("pins and unpins a project through the visible panel and persists both after reload", async () => {
  await app.tabs.create({ responses: [{ prompt: "A project to pin", reply: "Ready to pin" }] });
  await app.chat.sendPrompt("A project to pin");
  await app.chat.shouldShowAssistantReply("Ready to pin");
  await app.chat.shouldBeIdle();

  await app.projects.open();
  await app.projects.shouldBeUnpinned();
  await app.projects.pin();
  await app.projects.shouldBePinned();
  await app.projects.shouldShowActiveSession("A project to pin");
  await app.projects.close();

  await app.browser.reload();

  await app.projects.open();
  await app.projects.shouldBePinned();
  await app.projects.unpin();
  await app.projects.shouldBeUnpinned();
  await app.projects.shouldShowActiveSession("A project to pin");
  await app.projects.close();

  await app.browser.reload();

  await app.projects.open();
  await app.projects.shouldBeUnpinned();
  await app.projects.shouldShowActiveSession("A project to pin");
});
