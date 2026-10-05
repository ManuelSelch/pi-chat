import { test } from "@playwright/test";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";
import { startPiChatE2E, stopPiChatE2E } from "../infra/e2e/pi-chat-e2e-fixture.js";

let driver: PiChatBrowserDriver;
let stop: (() => Promise<void>) | undefined;

test.beforeEach(async ({ page }) => {
  const fixture = await startPiChatE2E(page);
  driver = fixture.driver;
  stop = () => stopPiChatE2E(fixture);
});

test.afterEach(async () => {
  await stop?.();
  stop = undefined;
});

test("sends a prompt through the visible Pi Chat app", async () => {
  await driver.SendPrompt("Hello");
  await driver.ShouldShowUserMessage("Hello");
  await driver.ShouldShowAssistantReply("Hello from the visible Pi Chat app.");
  await driver.ShouldBeIdle();
});
