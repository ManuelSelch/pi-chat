import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, { inboxEnabled: false });
});

test.afterEach(async () => {
  await app.dispose();
});

test("keeps visible conversations independent across tabs", async () => {
  const first = await app.Tabs.Create({ responses: [{ prompt: "First", reply: "First reply" }] });
  await app.Chat.SendPrompt("First");
  await app.Chat.ShouldShowAssistantReply("First reply");

  const second = await app.Tabs.Create({ responses: [{ prompt: "Second", reply: "Second reply" }] });
  await app.Chat.SendPrompt("Second");
  await app.Chat.ShouldShowAssistantReply("Second reply");

  await app.Tabs.SwitchTo(first);

  await app.Chat.ShouldShowAssistantReply("First reply");
  await app.Chat.ShouldNotShowMessage("Second reply");

  await app.Tabs.SwitchTo(second);

  await app.Chat.ShouldShowAssistantReply("Second reply");
  await app.Chat.ShouldNotShowMessage("First reply");
});

test("returns home after closing the last tab", async () => {
  const tab = await app.Tabs.Create({ responses: [] });

  await app.Tabs.Close(tab);

  await app.Home.ShouldBeVisible();
});
