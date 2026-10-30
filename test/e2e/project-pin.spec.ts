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
  await app.Tabs.Create({ responses: [{ prompt: "A project to pin", reply: "Ready to pin" }] });
  await app.Chat.SendPrompt("A project to pin");
  await app.Chat.ShouldShowAssistantReply("Ready to pin");
  await app.Chat.ShouldBeIdle();

  await app.Projects.Open();
  await app.Projects.ShouldBeUnpinned();
  await app.Projects.Pin();
  await app.Projects.ShouldBePinned();
  await app.Projects.ShouldShowActiveSession("A project to pin");
  await app.Projects.Close();

  await app.Browser.Reload();

  await app.Projects.Open();
  await app.Projects.ShouldBePinned();
  await app.Projects.Unpin();
  await app.Projects.ShouldBeUnpinned();
  await app.Projects.ShouldShowActiveSession("A project to pin");
  await app.Projects.Close();

  await app.Browser.Reload();

  await app.Projects.Open();
  await app.Projects.ShouldBeUnpinned();
  await app.Projects.ShouldShowActiveSession("A project to pin");
});
