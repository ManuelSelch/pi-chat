import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, {});
});

test.afterEach(async () => {
  await app.dispose();
});

test("keeps visible conversations independent across sidebar selections", async () => {
  const first = await app.sessions.create({ responses: [{ prompt: "First", reply: "First reply" }] });
  await app.chat.sendPrompt("First");
  await app.chat.shouldShowAssistantReply("First reply");

  const second = await app.sessions.create({ responses: [{ prompt: "Second", reply: "Second reply" }] });
  await app.chat.sendPrompt("Second");
  await app.chat.shouldShowAssistantReply("Second reply");

  await app.sessions.switchTo(first);

  await app.chat.shouldShowAssistantReply("First reply");
  await app.chat.shouldNotShowMessage("Second reply");

  await app.sessions.switchTo(second);

  await app.chat.shouldShowAssistantReply("Second reply");
  await app.chat.shouldNotShowMessage("First reply");
});

test("returns home after closing the last empty session view", async () => {
  const tab = await app.sessions.create({ responses: [] });

  await app.sessions.close(tab);

  await app.home.shouldBeVisible();
});
