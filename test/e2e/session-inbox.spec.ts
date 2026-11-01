import { test } from "../infra/e2e/coverage/fixtures.js";
import { PromptExtensionFixture } from "../infra/pi-chat/fixtures/prompt-extension-fixture.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
let prompts: PromptExtensionFixture;
test.beforeEach(async ({ page }) => {
  prompts = new PromptExtensionFixture();
  app = await PiChatBrowserDriver.start(page, { inboxEnabled: false, extensions: [prompts.extension], projectName: "a-very-long-checkout-name-that-must-truncate-before-controls", projectBranch: "fix/a-very-long-branch-name-that-must-truncate-before-controls" });
  await app.browser.setViewport(1024);
});
test.afterEach(async () => { await app.dispose(); });

async function savedConversation() {
  await app.tabs.create({ responses: [{ prompt: "Inbox conversation", reply: "Saved response" }] });
  await app.chat.sendPrompt("Inbox conversation");
  await app.chat.shouldShowAssistantReply("Saved response");
  await app.inbox.setEnabled(true);
}

test("parks and explicitly resumes a saved conversation without losing its draft", async () => {
  await savedConversation();
  await app.focus.typeWithoutRefocusing("Unsent draft");

  await app.inbox.parkCurrent();

  await app.inbox.shouldHaveLater(1);
  await app.inbox.resume("Inbox conversation");
  await app.chat.shouldShowAssistantReply("Saved response");
  await app.focus.shouldHaveDraft("Unsent draft");
  await app.inbox.shouldHideLater();
});

for (const action of ["close", "snooze", "archive"] as const) {
  test(`${action} current session returns Home with another session still open`, async () => {
    await savedConversation();
    await app.inbox.create({ responses: [{ prompt: "Other conversation", reply: "Other saved response" }] });
    await app.chat.sendPrompt("Other conversation");
    await app.chat.shouldShowAssistantReply("Other saved response");
    await app.inbox.select("Inbox conversation");

    if (action === "close") await app.inbox.closeView();
    else if (action === "snooze") await app.inbox.parkCurrent();
    else await app.inbox.archiveCurrent();

    await app.inbox.shouldShowHome();
    await app.inbox.shouldBeInSection("Other conversation", "Ready");
    if (action === "close") await app.inbox.shouldBeInSection("Inbox conversation", "Ready");
    if (action === "snooze") await app.inbox.shouldHaveLater(1);
    if (action === "archive") await app.inbox.shouldHaveNoArchiveNotice();

    await app.inbox.select("Other conversation");
    await app.chat.shouldShowAssistantReply("Other saved response");
  });
}

for (const action of ["snooze", "archive"] as const) {
  test(`${action} a background session does not leave the current conversation`, async () => {
    await savedConversation();
    await app.inbox.create({ responses: [{ prompt: "Other conversation", reply: "Other saved response" }] });
    await app.chat.sendPrompt("Other conversation");
    await app.chat.shouldShowAssistantReply("Other saved response");

    if (action === "snooze") await app.inbox.parkReady("Inbox conversation");
    else await app.inbox.archiveReady("Inbox conversation");

    await app.chat.shouldShowAssistantReply("Other saved response");
    await app.inbox.shouldBeInSection("Other conversation", "Ready");
  });
}

test("remembers Later across reload without sidebar search and hides it after the last resume", async () => {
  await savedConversation();
  await app.inbox.parkCurrent();

  await app.inbox.reload();

  await app.inbox.shouldHaveLater(1);
  await app.inbox.shouldHaveNoSearch();
  await app.inbox.resume("Inbox conversation");
  await app.chat.shouldShowAssistantReply("Saved response");
  await app.inbox.shouldHideLater();
});

test("closing the view preserves background work and completion becomes Ready without reopening it", async () => {
  await app.tabs.create({ responses: [
    { prompt: "Background conversation", reply: "Ready to work" },
    { prompt: "Background work", reply: "Finished in background", hold: true },
  ] });
  await app.chat.sendPrompt("Background conversation");
  await app.chat.shouldShowAssistantReply("Ready to work");
  await app.chat.sendPrompt("Background work");
  await app.inbox.setEnabled(true);
  await app.inbox.shouldBeInSection("Background conversation", "Working");

  await app.inbox.closeView();
  await app.inbox.create();
  await app.inbox.shouldBeInSection("Background conversation", "Working");
  await app.inbox.closeView();
  await app.inbox.finishResponse("Background conversation");

  await app.inbox.shouldShowHome();
  await app.inbox.select("Background conversation");
  await app.chat.shouldShowAssistantReply("Finished in background");
});

test("archiving the current conversation returns Home without an archive notice or Undo action", async () => {
  await savedConversation();

  await app.inbox.archiveCurrent();

  await app.inbox.shouldShowHome();
  await app.inbox.shouldHaveReady(0);
  await app.inbox.shouldHideStatusGroup("Needs you");
  await app.inbox.shouldHideStatusGroup("Working");
  await app.inbox.shouldHideLater();
  await app.inbox.shouldHaveNoArchiveNotice();
});

test("archiving a parked conversation removes it from Later without an archive notice or reopening it", async () => {
  await savedConversation();
  await app.inbox.parkCurrent();

  await app.inbox.archiveLater("Inbox conversation");

  await app.inbox.shouldHideLater();
  await app.inbox.shouldHaveReady(0);
  await app.inbox.shouldShowHome();
  await app.inbox.shouldHaveNoArchiveNotice();
});

test("does not park an unsaved session and removes an empty runtime from the session panel on close", async () => {
  await app.tabs.create({ responses: [] });
  await app.inbox.setEnabled(true);
  await app.focus.typeWithoutRefocusing("Unsaved conversation draft");

  await app.inbox.shouldPreventParking();
  await app.inbox.closeView();

  await app.inbox.shouldHaveReady(0);
  await app.inbox.reload();
  await app.inbox.shouldHaveReady(0);
  await app.inbox.shouldShowHome();
});

test("blocked prompts remain in Needs you when selected, and closing the view retains the chosen answer", async () => {
  await app.tabs.create({ responses: [] });
  await app.inbox.setEnabled(true);
  await app.chat.sendPrompt("/prompt-checks ");
  await app.prompts.shouldShowRichQuestion("Check 1");
  await app.prompts.choose("Check 1", "8");
  await app.prompts.minimize("Check 1");
  await app.inbox.shouldBeInSection("New session", "Needs you");

  await app.inbox.closeView();
  await app.inbox.select("New session");

  await app.inbox.shouldBeInSection("New session", "Needs you");
  await app.prompts.reopen("Check 1");
  await app.prompts.shouldHaveChoice("Check 1", "8");
  await app.prompts.minimize("Check 1");
  await app.prompts.stop();
  prompts.shouldHaveAnswers([]);
});

test("saved Ready history survives a backend restart without reopening Later", async () => {
  await savedConversation();

  await app.restartBackend();

  await app.inbox.shouldHaveReady(1);
  await app.inbox.shouldBeInSection("Inbox conversation", "Ready");
  await app.inbox.parkReady("Inbox conversation");
  await app.inbox.shouldHaveReady(0);
  await app.inbox.shouldHaveLater(1);

  await app.restartBackend();

  await app.inbox.shouldHaveReady(0);
  await app.inbox.shouldHaveLater(1);
  await app.inbox.resume("Inbox conversation");
  await app.chat.shouldShowAssistantReply("Saved response");
});

test("archiving unloaded Ready history stays at Home without an archive notice", async () => {
  await savedConversation();
  await app.restartBackend();

  await app.inbox.archiveReady("Inbox conversation");

  await app.inbox.shouldShowHome();
  await app.inbox.shouldHaveReady(0);
  await app.inbox.shouldHaveNoArchiveNotice();
});

test("row hitboxes and header controls do not overlap at desktop and phone widths", async () => {
  const title = "A long conversation title that truncates before actions";
  await app.tabs.create({ responses: [{ prompt: title, reply: "Saved response" }] });
  await app.chat.sendPrompt(title);
  await app.chat.shouldShowAssistantReply("Saved response");
  await app.inbox.setEnabled(true);

  for (const width of [1680, 1024, 640, 390]) {
    await app.browser.setViewport(width, 844);
    await app.inbox.shouldHaveSoundGeometry(title, { working: false, later: false });
    if (width < 640) await app.inbox.close();
    await app.inbox.shouldHaveSoundHeaderGeometry();
    if (width < 640) await app.inbox.open();
  }
});

test("mode toggling preserves selection and drafts, and phones retain a modal navigation drawer", async () => {
  await savedConversation();
  await app.focus.typeWithoutRefocusing("Mode-independent draft");
  await app.inbox.setEnabled(false);
  await app.tabs.shouldHaveCount(1);
  await app.focus.shouldHaveDraft("Mode-independent draft");
  await app.inbox.setEnabled(true);

  await app.browser.setViewport(390, 844);
  await app.inbox.shouldBeDrawer();
  await app.inbox.select("Inbox conversation");
  await app.inbox.shouldBeDrawer();
  await app.inbox.openSettings();
  await app.settings.close();
  await app.inbox.open();
  await app.inbox.close();

  await app.focus.shouldHaveDraft("Mode-independent draft");
});
