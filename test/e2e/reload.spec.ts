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
  await app.tabs.create({ responses: [{ prompt: "Hello", reply: "Welcome back" }] });
  await app.chat.sendPrompt("Hello");
  await app.chat.shouldShowAssistantReply("Welcome back");

  await app.browser.reload();

  await app.chat.shouldShowUserMessage("Hello");
  await app.chat.shouldShowAssistantReply("Welcome back");
  await app.chat.shouldBeIdle();
});
