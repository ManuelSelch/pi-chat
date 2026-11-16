import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, { inboxEnabled: false });
});

test.afterEach(async () => {
  await app.dispose();
});

test("steers a running Pi session and restores the queue after browser reload", async () => {
  await app.tabs.create({ responses: [{ prompt: "Start working", reply: "Held response.", hold: true }] });
  await app.chat.sendPrompt("Start working");
  await app.chat.shouldBeSteering();
  await app.chat.sendPrompt("Keep the existing shortcuts");
  await app.chat.shouldHaveQueuedSteering(["Keep the existing shortcuts"]);
  await app.chat.sendPrompt("Use the native Pi queue");
  await app.chat.shouldHaveQueuedSteering(["Keep the existing shortcuts", "Use the native Pi queue"]);
  await app.browser.reload();
  await app.chat.shouldBeSteering();
  await app.chat.shouldHaveQueuedSteering(["Keep the existing shortcuts", "Use the native Pi queue"]);
});

for (const command of ["!pwd", "!!pwd"]) {
  test(`keeps ${command} blocked while steering`, async () => {
    await app.tabs.create({ responses: [{ prompt: "Start working", reply: "Held response.", hold: true }] });
    await app.chat.sendPrompt("Start working");
    await app.chat.shouldBeSteering();
    await app.chat.sendPrompt(command);
    await app.skills.shouldHaveDraft(command);
    await app.chat.shouldBeSteering();
  });
}

test("creates a session from home and sends a prompt through the visible app", async () => {
  await app.home.shouldBeVisible();
  await app.tabs.create({ responses: [{ prompt: "Hello", reply: "Hello from the visible Pi Chat app." }] });

  await app.chat.sendPrompt("Hello");
  await app.chat.shouldShowUserMessage("Hello");
  await app.chat.shouldShowAssistantReply("Hello from the visible Pi Chat app.");
  await app.chat.shouldBeIdle();
});
