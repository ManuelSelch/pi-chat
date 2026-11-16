import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, {
    projectName: "palette-checkout", repositoryName: "palette-repo", projectBranch: "feature/palette", linkedWorktree: true, inboxEnabled: false,
  });
  await app.tabs.create({ responses: [{ prompt: "Find this session", reply: "Ready" }] });
  await app.chat.sendPrompt("Find this session");
  await app.chat.shouldShowAssistantReply("Ready");
});

test.afterEach(async () => {
  await app.dispose();
});

test("folder and worktree paths follow the folder-path setting", async () => {
  await app.settings.open();
  await app.settings.setFolderPathsVisible(false);
  await app.settings.close();
  await app.quickOpen.open();
  await app.quickOpen.shouldHideFolderAndWorktreePaths();

  await app.quickOpen.close();
  await app.settings.open();
  await app.settings.setFolderPathsVisible(true);
  await app.settings.close();
  await app.quickOpen.open();
  await app.quickOpen.shouldShowFolderAndWorktreePaths();
});

test("hidden folder paths remain searchable in Quick Switcher", async () => {
  await app.settings.open();
  await app.settings.setFolderPathsVisible(false);
  await app.settings.close();
  await app.quickOpen.open();
  await app.quickOpen.searchByFolderPath();
  await app.quickOpen.shouldFindMatchingFolderWithoutShowingItsPath();
});
