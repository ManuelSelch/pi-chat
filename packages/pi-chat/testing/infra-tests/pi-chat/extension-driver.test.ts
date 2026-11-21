import { afterEach, expect, it } from "vitest";
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

it("rejects unknown commands without calling a model", async () => {
  const app = await start();

  await expect(app.extensions.runCommand("not-registered")).rejects.toThrow("Unknown extension command");

  app.chat.shouldHaveMessageCount(0);
  app.chat.shouldHaveConsumedResponses();
}, 15000);

it("rejects extension commands without an active conversation", async () => {
  const app = await PiChatDriver.start({ startAtHome: true, extensions: [confirmationExtension] });
  apps.push(app);

  await expect(app.extensions.runCommand("test-confirm")).rejects.toThrow("No active conversation");

  app.browser.shouldBeAtHome();
}, 15000);

it("rejects a second command while a prompt is pending", async () => {
  const app = await start();

  await app.extensions.runCommand("test-confirm");
  const prompt = await app.extensions.waitForPrompt("Apply change?");

  await expect(app.extensions.runCommand("test-confirm")).rejects.toThrow("Answer the pending prompt");

  await app.extensions.respondToPrompt(prompt, { cancelled: true });
  await app.extensions.waitForNotification("Change cancelled", "warning");
}, 15000);

it("rejects foreign, wrong-conversation, and already-answered prompt handles", async () => {
  const app = await start();
  const other = await start();
  const original = app.tabs.active();

  await app.extensions.runCommand("test-confirm");
  const prompt = await app.extensions.waitForPrompt("Apply change?");

  await expect(other.extensions.respondToPrompt(prompt, { cancelled: true })).rejects.toThrow("another application");

  await app.tabs.create();
  await expect(app.extensions.respondToPrompt(prompt, { cancelled: true })).rejects.toThrow("Switch to the prompt's conversation");

  await app.tabs.switchTo(original);
  await app.extensions.respondToPrompt(prompt, { cancelled: true });
  await app.extensions.waitForNotification("Change cancelled", "warning");

  await expect(app.extensions.respondToPrompt(prompt, { cancelled: true })).rejects.toThrow("no longer pending");
}, 15000);

it("waits for a fresh notification when repeating the same command", async () => {
  const app = await start();

  await app.extensions.runCommand("test-confirm");
  const first = await app.extensions.waitForPrompt("Apply change?");
  await app.extensions.respondToPrompt(first, { cancelled: true });
  await app.extensions.waitForNotification("Change cancelled", "warning");

  await app.extensions.runCommand("test-confirm");
  let received = false;
  const notification = app.extensions.waitForNotification("Change cancelled", "warning").then(() => { received = true; });
  const second = await app.extensions.waitForPrompt("Apply change?");

  expect(received).toBe(false);

  await app.extensions.respondToPrompt(second, { cancelled: true });
  await notification;
  expect(received).toBe(true);
}, 15000);

it("does not load fixtures into an application that did not request them", async () => {
  const app = await start();
  const other = await PiChatDriver.start();
  apps.push(other);

  await expect(other.extensions.runCommand("test-confirm")).rejects.toThrow("Unknown extension command");

  await app.extensions.runCommand("test-confirm");
  const prompt = await app.extensions.waitForPrompt("Apply change?");
  await app.extensions.respondToPrompt(prompt, { cancelled: true });
  await app.extensions.waitForNotification("Change cancelled", "warning");
}, 15000);
