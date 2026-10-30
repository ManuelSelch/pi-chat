import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, { inboxEnabled: false });
});

test.afterEach(async () => {
  await app.dispose();
});

test("restores the visible conversation after a browser reload", async () => {
  await app.Tabs.Create({ responses: [{ prompt: "Hello", reply: "Welcome back" }] });
  await app.Chat.SendPrompt("Hello");
  await app.Chat.ShouldShowAssistantReply("Welcome back");

  await app.Browser.Reload();

  await app.Chat.ShouldShowUserMessage("Hello");
  await app.Chat.ShouldShowAssistantReply("Welcome back");
  await app.Chat.ShouldBeIdle();
});
