import { test } from "../infra/e2e/coverage/fixtures.js";
import { PromptExtensionFixture } from "../infra/pi-chat/fixtures/prompt-extension-fixture.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
let prompts: PromptExtensionFixture;
test.beforeEach(async ({ page }) => {
  prompts = new PromptExtensionFixture();
  app = await PiChatBrowserDriver.start(page, { extensions: [prompts.extension] });
  await app.Browser.SetViewport(1024);
});
test.afterEach(async () => { await app.dispose(); });

async function savedConversation() {
  await app.Tabs.Create({ responses: [{ prompt: "Inbox conversation", reply: "Saved response" }] });
  await app.Chat.SendPrompt("Inbox conversation");
  await app.Chat.ShouldShowAssistantReply("Saved response");
  await app.Inbox.setEnabled(true);
}

test("parks and explicitly resumes a saved conversation without losing its draft", async () => {
  await savedConversation();
  await app.Focus.TypeWithoutRefocusing("Unsent draft");

  await app.Inbox.parkCurrent();

  await app.Inbox.shouldHaveLater(1);
  await app.Inbox.resume("Inbox conversation");
  await app.Chat.ShouldShowAssistantReply("Saved response");
  await app.Focus.ShouldHaveDraft("Unsent draft");
  await app.Inbox.shouldHaveLater(0, true);
});

test("remembers Later across reload and search does not expand it", async () => {
  await savedConversation();
  await app.Inbox.parkCurrent();

  await app.Inbox.reload();

  await app.Inbox.shouldHaveLater(1);
  await app.Inbox.search("Inbox conversation");
  await app.Inbox.shouldHaveLater(1);
  await app.Inbox.search("no match");
  await app.Inbox.shouldHaveLater(0);
  await app.Inbox.search("");
  await app.Inbox.resume("Inbox conversation");
  await app.Chat.ShouldShowAssistantReply("Saved response");
});

test("closing the view preserves background work and completion becomes Ready without reopening it", async () => {
  await app.Tabs.Create({ responses: [
    { prompt: "Background conversation", reply: "Ready to work" },
    { prompt: "Background work", reply: "Finished in background", hold: true },
  ] });
  await app.Chat.SendPrompt("Background conversation");
  await app.Chat.ShouldShowAssistantReply("Ready to work");
  await app.Chat.SendPrompt("Background work");
  await app.Inbox.setEnabled(true);
  await app.Inbox.shouldBeInSection("Background conversation", "Working");

  await app.Inbox.closeView();
  await app.Inbox.create();
  await app.Inbox.shouldBeInSection("Background conversation", "Working");
  await app.Inbox.closeView();
  await app.Inbox.finishResponse("Background conversation");

  await app.Inbox.shouldShowEmptyView();
  await app.Inbox.select("Background conversation");
  await app.Chat.ShouldShowAssistantReply("Finished in background");
});

test("archive Undo restores the conversation and its unsent draft", async () => {
  await savedConversation();
  await app.Focus.TypeWithoutRefocusing("Draft before archive");

  await app.Inbox.archiveCurrent();
  await app.Inbox.shouldHaveLater(0);
  await app.Inbox.undoArchive();

  await app.Chat.ShouldShowAssistantReply("Saved response");
  await app.Focus.ShouldHaveDraft("Draft before archive");
});

test("archiving a parked session and Undo retain Later membership without reopening it", async () => {
  await savedConversation();
  await app.Inbox.parkCurrent();
  await app.Inbox.archiveLater("Inbox conversation");
  await app.Inbox.shouldHaveLater(0, true);

  await app.Inbox.undoArchiveToLater();

  await app.Inbox.shouldHaveLater(1, true);
  await app.Inbox.resume("Inbox conversation");
  await app.Chat.ShouldShowAssistantReply("Saved response");
});

test("does not park an unsaved session and keeps its draft when the view is closed", async () => {
  await app.Tabs.Create({ responses: [] });
  await app.Inbox.setEnabled(true);
  await app.Focus.TypeWithoutRefocusing("Unsaved conversation draft");

  await app.Inbox.shouldPreventParking();
  await app.Inbox.closeView();
  await app.Inbox.select("New session");

  await app.Focus.ShouldHaveDraft("Unsaved conversation draft");
});

test("blocked prompts remain in Needs you when selected, and closing the view retains the chosen answer", async () => {
  await app.Tabs.Create({ responses: [] });
  await app.Inbox.setEnabled(true);
  await app.Chat.SendPrompt("/prompt-checks ");
  await app.Prompts.ShouldShowRichQuestion("Check 1");
  await app.Prompts.Choose("Check 1", "8");
  await app.Prompts.Minimize("Check 1");
  await app.Inbox.shouldBeInSection("New session", "Needs you");

  await app.Inbox.closeView();
  await app.Inbox.select("New session");

  await app.Inbox.shouldBeInSection("New session", "Needs you");
  await app.Prompts.Reopen("Check 1");
  await app.Prompts.ShouldHaveChoice("Check 1", "8");
  await app.Prompts.Minimize("Check 1");
  await app.Prompts.Stop();
  prompts.ShouldHaveAnswers([]);
});

test("mode toggling preserves selection and drafts, and phones retain a modal navigation drawer", async () => {
  await savedConversation();
  await app.Focus.TypeWithoutRefocusing("Mode-independent draft");
  await app.Inbox.setEnabled(false);
  await app.Tabs.ShouldHaveCount(1);
  await app.Focus.ShouldHaveDraft("Mode-independent draft");
  await app.Inbox.setEnabled(true);

  await app.Browser.SetViewport(390, 844);
  await app.Inbox.shouldBeDrawer();
  await app.Inbox.select("Inbox conversation");
  await app.Inbox.shouldBeDrawer();
  await app.Inbox.openSettings();
  await app.Settings.Close();
  await app.Inbox.open();
  await app.Inbox.close();

  await app.Focus.ShouldHaveDraft("Mode-independent draft");
});
