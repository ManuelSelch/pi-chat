import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
const repositoryName = "fresh-repository";
const branch = "feature/fresh-checkout";

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, {
    inboxEnabled: false, repositoryName, projectName: "fresh-checkout", projectBranch: branch, linkedWorktree: true,
  });
  await app.browser.setViewport(1024);
});
test.afterEach(async () => { await app.dispose(); });

test("an unsaved worktree session shows repository and branch labels before any message", async () => {
  await app.tabs.create({ responses: [] });
  await app.inbox.setEnabled(true);

  await app.inbox.shouldShowWorktreeSession(repositoryName, branch);

  await app.quickOpen.open();

  await app.quickOpen.shouldShowWorktreeSession(repositoryName, branch);
});

test("persisting the first conversation preserves worktree labels and title-based discovery", async () => {
  const title = "Implement checkout setup";
  await app.tabs.create({ responses: [{ prompt: title, reply: "Setup complete" }] });
  await app.inbox.setEnabled(true);

  await app.inbox.shouldShowWorktreeSession(repositoryName, branch);

  await app.chat.sendPrompt(title);
  await app.chat.shouldShowAssistantReply("Setup complete");

  await app.inbox.shouldShowProjectName(title, repositoryName);
  await app.inbox.shouldShowCompactWorktreeLabels(title, branch);

  await app.quickOpen.open();

  await app.quickOpen.shouldShowWorktreeSession(repositoryName, branch);
  await app.quickOpen.shouldFindWorktreeSessionByTitle(title, repositoryName, branch);
});
