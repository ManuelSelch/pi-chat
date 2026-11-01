import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, {
    projectName: "palette-checkout", repositoryName: "palette-repo", projectBranch: "feature/palette", linkedWorktree: true, inboxEnabled: false,
  });
  await app.Tabs.Create({ responses: [{ prompt: "Find this session", reply: "Ready" }] });
  await app.Chat.SendPrompt("Find this session");
  await app.Chat.ShouldShowAssistantReply("Ready");
});

test.afterEach(async () => {
  await app.dispose();
});

test("folder and worktree paths follow the folder-path setting", async () => {
  await app.Settings.Open();
  await app.Settings.SetFolderPathsVisible(false);
  await app.Settings.Close();
  await app.QuickOpen.open();
  await app.QuickOpen.shouldHideFolderAndWorktreePaths();

  await app.QuickOpen.close();
  await app.Settings.Open();
  await app.Settings.SetFolderPathsVisible(true);
  await app.Settings.Close();
  await app.QuickOpen.open();
  await app.QuickOpen.shouldShowFolderAndWorktreePaths();
});

test("hidden folder paths remain searchable in Quick Switcher", async () => {
  await app.Settings.Open();
  await app.Settings.SetFolderPathsVisible(false);
  await app.Settings.Close();
  await app.QuickOpen.open();
  await app.QuickOpen.searchByFolderPath();
  await app.QuickOpen.shouldFindMatchingFolderWithoutShowingItsPath();
});
