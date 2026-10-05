import { test } from "@playwright/test";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let driver: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  driver = await PiChatBrowserDriver.start(page);
});

test.afterEach(async () => {
  await driver.dispose();
});

test("sends a prompt through the visible Pi Chat app", async () => {
  await driver.SendPrompt("Hello");
  await driver.ShouldShowUserMessage("Hello");
  await driver.ShouldShowAssistantReply("Hello from the visible Pi Chat app.");
  await driver.ShouldBeIdle();
});
