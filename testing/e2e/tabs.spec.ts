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
  const first = await app.tabs.create({ responses: [{ prompt: "First", reply: "First reply" }] });
  await app.chat.sendPrompt("First");
  await app.chat.shouldShowAssistantReply("First reply");

  const second = await app.tabs.create({ responses: [{ prompt: "Second", reply: "Second reply" }] });
  await app.chat.sendPrompt("Second");
  await app.chat.shouldShowAssistantReply("Second reply");

  await app.tabs.switchTo(first);

  await app.chat.shouldShowAssistantReply("First reply");
  await app.chat.shouldNotShowMessage("Second reply");

  await app.tabs.switchTo(second);

  await app.chat.shouldShowAssistantReply("Second reply");
  await app.chat.shouldNotShowMessage("First reply");
});

test("returns home after closing the last tab", async () => {
  const tab = await app.tabs.create({ responses: [] });

  await app.tabs.close(tab);

  await app.home.shouldBeVisible();
});
