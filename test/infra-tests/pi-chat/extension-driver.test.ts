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

  await expect(app.Extensions.RunCommand("not-registered")).rejects.toThrow("Unknown extension command");

  app.Chat.ShouldHaveMessageCount(0);
  app.Chat.ShouldHaveConsumedResponses();
}, 15000);

it("rejects extension commands without an active conversation", async () => {
  const app = await PiChatDriver.start({ startAtHome: true, extensions: [confirmationExtension] });
  apps.push(app);

  await expect(app.Extensions.RunCommand("test-confirm")).rejects.toThrow("No active conversation");

  app.Browser.ShouldBeAtHome();
}, 15000);

it("rejects a second command while a prompt is pending", async () => {
  const app = await start();

  await app.Extensions.RunCommand("test-confirm");
  const prompt = await app.Extensions.WaitForPrompt("Apply change?");

  await expect(app.Extensions.RunCommand("test-confirm")).rejects.toThrow("Answer the pending prompt");

  await app.Extensions.RespondToPrompt(prompt, { cancelled: true });
  await app.Extensions.WaitForNotification("Change cancelled", "warning");
}, 15000);

it("rejects foreign, wrong-conversation, and already-answered prompt handles", async () => {
  const app = await start();
  const other = await start();
  const original = app.Tabs.Active();

  await app.Extensions.RunCommand("test-confirm");
  const prompt = await app.Extensions.WaitForPrompt("Apply change?");

  await expect(other.Extensions.RespondToPrompt(prompt, { cancelled: true })).rejects.toThrow("another application");

  await app.Tabs.Create();
  await expect(app.Extensions.RespondToPrompt(prompt, { cancelled: true })).rejects.toThrow("Switch to the prompt's conversation");

  await app.Tabs.SwitchTo(original);
  await app.Extensions.RespondToPrompt(prompt, { cancelled: true });
  await app.Extensions.WaitForNotification("Change cancelled", "warning");

  await expect(app.Extensions.RespondToPrompt(prompt, { cancelled: true })).rejects.toThrow("no longer pending");
}, 15000);

it("waits for a fresh notification when repeating the same command", async () => {
  const app = await start();

  await app.Extensions.RunCommand("test-confirm");
  const first = await app.Extensions.WaitForPrompt("Apply change?");
  await app.Extensions.RespondToPrompt(first, { cancelled: true });
  await app.Extensions.WaitForNotification("Change cancelled", "warning");

  await app.Extensions.RunCommand("test-confirm");
  let received = false;
  const notification = app.Extensions.WaitForNotification("Change cancelled", "warning").then(() => { received = true; });
  const second = await app.Extensions.WaitForPrompt("Apply change?");

  expect(received).toBe(false);

  await app.Extensions.RespondToPrompt(second, { cancelled: true });
  await notification;
  expect(received).toBe(true);
}, 15000);

it("does not load fixtures into an application that did not request them", async () => {
  const app = await start();
  const other = await PiChatDriver.start();
  apps.push(other);

  await expect(other.Extensions.RunCommand("test-confirm")).rejects.toThrow("Unknown extension command");

  await app.Extensions.RunCommand("test-confirm");
  const prompt = await app.Extensions.WaitForPrompt("Apply change?");
  await app.Extensions.RespondToPrompt(prompt, { cancelled: true });
  await app.Extensions.WaitForNotification("Change cancelled", "warning");
}, 15000);
