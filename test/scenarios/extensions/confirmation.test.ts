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

    await app.Extensions.RunCommand("test-confirm");
    const prompt = await app.Extensions.WaitForPrompt("Apply change?");

    app.Extensions.ShouldShowPrompt("Apply change?", "confirm", "Update the test widget?");
    await app.Extensions.RespondToPrompt(prompt, { cancelled: false, value: true });
    await app.Extensions.WaitForNotification("Change approved", "info");

    app.Extensions.ShouldHaveNoPrompts();
    app.Extensions.ShouldShowNotification("Change approved", "info");
    app.Extensions.ShouldShowWidget("test-result", ["Change approved"], "belowEditor");
    app.Chat.ShouldHaveConsumedResponses();
  }, 15000);

  it("cancels an extension prompt without applying the approval outcome", async () => {
    const app = await start();

    await app.Extensions.RunCommand("test-confirm");
    const prompt = await app.Extensions.WaitForPrompt("Apply change?");

    await app.Extensions.RespondToPrompt(prompt, { cancelled: true });
    await app.Extensions.WaitForNotification("Change cancelled", "warning");

    app.Extensions.ShouldHaveNoPrompts();
    app.Extensions.ShouldShowNotification("Change cancelled", "warning");
    app.Extensions.ShouldShowWidget("test-result", ["Change cancelled"], "belowEditor");
  }, 15000);

  it("restores a pending prompt after reconnect and preserves the resulting widget", async () => {
    const app = await start();

    await app.Extensions.RunCommand("test-confirm");
    const prompt = await app.Extensions.WaitForPrompt("Apply change?");

    await app.Browser.Reconnect();
    app.Extensions.ShouldShowPrompt("Apply change?", "confirm");

    await app.Extensions.RespondToPrompt(prompt, { cancelled: false, value: true });
    await app.Extensions.WaitForNotification("Change approved", "info");

    await app.Browser.Reconnect();

    app.Extensions.ShouldHaveNoPrompts();
    app.Extensions.ShouldShowWidget("test-result", ["Change approved"], "belowEditor");
  }, 15000);

  it("keeps extension widgets and prompts isolated between conversations", async () => {
    const app = await start();
    const first = app.Tabs.Active();

    await app.Extensions.RunCommand("test-confirm");
    const prompt = await app.Extensions.WaitForPrompt("Apply change?");
    await app.Extensions.RespondToPrompt(prompt, { cancelled: false, value: true });
    await app.Extensions.WaitForNotification("Change approved", "info");

    const second = await app.Tabs.Create();

    app.Extensions.ShouldHaveNoPrompts();
    app.Extensions.ShouldNotShowWidget("test-result");

    await app.Extensions.RunCommand("test-confirm");
    const otherPrompt = await app.Extensions.WaitForPrompt("Apply change?");
    await app.Extensions.RespondToPrompt(otherPrompt, { cancelled: true });
    await app.Extensions.WaitForNotification("Change cancelled", "warning");

    await app.Tabs.SwitchTo(first);
    app.Extensions.ShouldShowWidget("test-result", ["Change approved"], "belowEditor");

    await app.Tabs.SwitchTo(second);
    app.Extensions.ShouldShowWidget("test-result", ["Change cancelled"], "belowEditor");
  }, 15000);
});
