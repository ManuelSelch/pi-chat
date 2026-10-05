import { test } from "@playwright/test";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page);
});

test.afterEach(async () => {
  await app.dispose();
});

test("creates a session from home and sends a prompt through the visible app", async () => {
  await app.Home.ShouldBeVisible();
  await app.Tabs.Create({ responses: [{ prompt: "Hello", reply: "Hello from the visible Pi Chat app." }] });

  await app.Chat.SendPrompt("Hello");
  await app.Chat.ShouldShowUserMessage("Hello");
  await app.Chat.ShouldShowAssistantReply("Hello from the visible Pi Chat app.");
  await app.Chat.ShouldBeIdle();
});
