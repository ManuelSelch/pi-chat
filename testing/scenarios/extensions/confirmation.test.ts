import { afterEach, describe, it } from "vitest";
import { PiChatDriver } from "../../infra/pi-chat/pi-chat-driver.js";
import { confirmationExtension } from "../../infra/pi-chat/fixtures/confirmation-extension.js";

const apps: PiChatDriver[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.dispose();
  }
});

async function start(): Promise<PiChatDriver> {
  const app = await PiChatDriver.start({ extensions: [confirmationExtension] });
  apps.push(app);
  return app;
}

describe("Pi Chat extension confirmation workflows", () => {
  it("confirms an extension prompt and shows its notification and widget", async () => {
    const app = await start();

    await app.extensions.runCommand("test-confirm");
    const prompt = await app.extensions.waitForPrompt("Apply change?");

    app.extensions.shouldShowPrompt("Apply change?", "confirm", "Update the test widget?");
    await app.extensions.respondToPrompt(prompt, { cancelled: false, value: true });
    await app.extensions.waitForNotification("Change approved", "info");

    app.extensions.shouldHaveNoPrompts();
    app.extensions.shouldShowNotification("Change approved", "info");
    app.extensions.shouldShowWidget("test-result", ["Change approved"], "belowEditor");
    app.chat.shouldHaveConsumedResponses();
  }, 15000);

  it("cancels an extension prompt without applying the approval outcome", async () => {
    const app = await start();

    await app.extensions.runCommand("test-confirm");
    const prompt = await app.extensions.waitForPrompt("Apply change?");

    await app.extensions.respondToPrompt(prompt, { cancelled: true });
    await app.extensions.waitForNotification("Change cancelled", "warning");

    app.extensions.shouldHaveNoPrompts();
    app.extensions.shouldShowNotification("Change cancelled", "warning");
    app.extensions.shouldShowWidget("test-result", ["Change cancelled"], "belowEditor");
  }, 15000);

  it("restores a pending prompt after reconnect and preserves the resulting widget", async () => {
    const app = await start();

    await app.extensions.runCommand("test-confirm");
    const prompt = await app.extensions.waitForPrompt("Apply change?");

    await app.browser.reconnect();
    app.extensions.shouldShowPrompt("Apply change?", "confirm");

    await app.extensions.respondToPrompt(prompt, { cancelled: false, value: true });
    await app.extensions.waitForNotification("Change approved", "info");

    await app.browser.reconnect();

    app.extensions.shouldHaveNoPrompts();
    app.extensions.shouldShowWidget("test-result", ["Change approved"], "belowEditor");
  }, 15000);

  it("keeps extension widgets and prompts isolated between conversations", async () => {
    const app = await start();
    const first = app.tabs.active();

    await app.extensions.runCommand("test-confirm");
    const prompt = await app.extensions.waitForPrompt("Apply change?");
    await app.extensions.respondToPrompt(prompt, { cancelled: false, value: true });
    await app.extensions.waitForNotification("Change approved", "info");

    const second = await app.tabs.create();

    app.extensions.shouldHaveNoPrompts();
    app.extensions.shouldNotShowWidget("test-result");

    await app.extensions.runCommand("test-confirm");
    const otherPrompt = await app.extensions.waitForPrompt("Apply change?");
    await app.extensions.respondToPrompt(otherPrompt, { cancelled: true });
    await app.extensions.waitForNotification("Change cancelled", "warning");

    await app.tabs.switchTo(first);
    app.extensions.shouldShowWidget("test-result", ["Change approved"], "belowEditor");

    await app.tabs.switchTo(second);
    app.extensions.shouldShowWidget("test-result", ["Change cancelled"], "belowEditor");
  }, 15000);
});
