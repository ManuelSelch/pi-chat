import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";
import { QuickOpenFolderPathDriver } from "../infra/e2e/quick-open-folder-path-driver.js";

let app: PiChatBrowserDriver | undefined;
let quickOpen: QuickOpenFolderPathDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, {
    projectName: "palette-checkout", repositoryName: "palette-repo", projectBranch: "feature/palette", linkedWorktree: true, inboxEnabled: false,
  });
  await app.Tabs.Create({ responses: [{ prompt: "Find this session", reply: "Ready" }] });
  await app.Chat.SendPrompt("Find this session");
  await app.Chat.ShouldShowAssistantReply("Ready");
  quickOpen = new QuickOpenFolderPathDriver(page);
});

test.afterEach(async () => {
  await app?.dispose();
  app = undefined;
});

test("folder and worktree paths follow the folder-path setting", async () => {
  await app!.Settings.Open();
  await app!.Settings.SetFolderPathsVisible(false);
  await app!.Settings.Close();
  await quickOpen.open();
  await quickOpen.shouldHideFolderAndWorktreePaths();

  await quickOpen.close();
  await app!.Settings.Open();
  await app!.Settings.SetFolderPathsVisible(true);
  await app!.Settings.Close();
  await quickOpen.open();
  await quickOpen.shouldShowFolderAndWorktreePaths();
});

test("hidden folder paths remain searchable in Quick Switcher", async () => {
  await app!.Settings.Open();
  await app!.Settings.SetFolderPathsVisible(false);
  await app!.Settings.Close();
  await quickOpen.open();
  await quickOpen.searchByFolderPath();
  await quickOpen.shouldFindMatchingFolderWithoutShowingItsPath();
});
