import { test } from "@playwright/test";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page);
});

test.afterEach(async () => {
  await app.dispose();
});

test("steers a running Pi session and restores the queue after browser reload", async () => {
  await app.Tabs.Create({ responses: [{ prompt: "Start working", reply: "Held response.", hold: true }] });
  await app.Chat.SendPrompt("Start working");
  await app.Chat.ShouldBeSteering();
  await app.Chat.SendPrompt("Keep the existing shortcuts");
  await app.Chat.ShouldHaveQueuedSteering(["Keep the existing shortcuts"]);
  await app.Chat.SendPrompt("Use the native Pi queue");
  await app.Chat.ShouldHaveQueuedSteering(["Keep the existing shortcuts", "Use the native Pi queue"]);
  await app.Browser.Reload();
  await app.Chat.ShouldBeSteering();
  await app.Chat.ShouldHaveQueuedSteering(["Keep the existing shortcuts", "Use the native Pi queue"]);
});

test("creates a session from home and sends a prompt through the visible app", async () => {
  await app.Home.ShouldBeVisible();
  await app.Tabs.Create({ responses: [{ prompt: "Hello", reply: "Hello from the visible Pi Chat app." }] });

  await app.Chat.SendPrompt("Hello");
  await app.Chat.ShouldShowUserMessage("Hello");
  await app.Chat.ShouldShowAssistantReply("Hello from the visible Pi Chat app.");
  await app.Chat.ShouldBeIdle();
});
