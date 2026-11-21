import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
test.beforeEach(async ({ page }) => { app = await PiChatBrowserDriver.start(page, { inboxEnabled: false }); });
test.afterEach(async () => { await app.dispose(); });

test("tracks the session title from creation through prompt and title update", async () => {
  await app.tabs.create({ responses: [{ prompt: "Original title", reply: "Ready" }] });

  await app.quickOpen.open();
  await app.quickOpen.shouldShowSessionOnce("New session");
  await app.quickOpen.close();

  await app.chat.sendPrompt("Original title");
  await app.chat.shouldShowAssistantReply("Ready");
  await app.quickOpen.open();
  await app.quickOpen.shouldShowSessionOnce("Original title");
  await app.quickOpen.shouldNotShowSession("New session");
  await app.quickOpen.close();

  await app.tabs.changeLiveTitleWhileCatalogueIsStale("Updated title");
  await app.quickOpen.open();
  await app.quickOpen.shouldShowSessionOnce("Updated title");
  await app.quickOpen.shouldNotShowSession("Original title");
});

test("focuses an unsaved session from Quick Switcher", async () => {
  const unsaved = await app.tabs.create({ responses: [] });
  await app.tabs.create({ responses: [{ prompt: "Other conversation", reply: "Ready" }] });
  await app.chat.sendPrompt("Other conversation");
  await app.chat.shouldShowAssistantReply("Ready");

  await app.quickOpen.open();
  await app.quickOpen.shouldShowSessionOnce("New session");
  await app.quickOpen.selectSession("New session");
  await app.tabs.shouldBeSelected(unsaved);
  await app.tabs.shouldHaveCount(2);
});

test("reopens a saved session that has no live runtime", async () => {
  const session = await app.tabs.create({ responses: [{ prompt: "Saved conversation", reply: "Saved reply" }] });
  await app.chat.sendPrompt("Saved conversation");
  await app.chat.shouldShowAssistantReply("Saved reply");
  await app.tabs.close(session);

  await app.quickOpen.open();
  await app.quickOpen.selectSession("Saved conversation");
  await app.chat.shouldShowAssistantReply("Saved reply");
});
