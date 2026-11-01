import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
const repositoryName = "my-project";
const branch = "feature/csmm-6-setup-shadcn";
const title = "Set up shadcn components";
test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, { inboxEnabled: false, repositoryName, projectName: "worktree-labels", projectBranch: branch, linkedWorktree: true });
  await app.browser.setViewport(1024);
});
test.afterEach(async () => { await app.dispose(); });

test("a single worktree session uses two lines while retaining title-based discovery and actions", async () => {
  await app.tabs.create({ responses: [{ prompt: title, reply: "Setup complete" }] });
  await app.chat.sendPrompt(title);
  await app.chat.shouldShowAssistantReply("Setup complete");
  await app.inbox.setEnabled(true);

  await app.inbox.shouldShowCompactWorktreeLabels(title, branch);
  await app.inbox.shouldHaveNoSearch();
  await app.inbox.shouldHaveReady(1);

  await app.restartBackend();

  await app.inbox.shouldShowCompactWorktreeLabels(title, branch);
  await app.inbox.parkReady(title);
  await app.inbox.expandLater();

  await app.inbox.shouldShowCompactWorktreeLabels(title, branch, true);
  await app.browser.setViewport(390, 844);
  await app.inbox.shouldShowCompactWorktreeLabels(title, branch, true);

  await app.inbox.resume(title);

  await app.inbox.shouldShowCompactWorktreeLabels(title, branch);
});

test("shared worktrees retain distinct conversation subtitles across Ready, Later and restart", async () => {
  const sibling = "Review setup checks";
  for (const prompt of [title, sibling]) {
    await app.tabs.create({ responses: [{ prompt, reply: "Done" }] });
    await app.chat.sendPrompt(prompt);
    await app.chat.shouldShowAssistantReply("Done");
  }
  await app.inbox.setEnabled(true);

  await app.inbox.shouldShowWorktreeLabels(title, branch);
  await app.inbox.shouldShowWorktreeLabels(sibling, branch);
  await app.inbox.parkReady(title);
  await app.inbox.expandLater();

  await app.inbox.shouldShowWorktreeLabels(title, branch, true);
  await app.inbox.shouldShowWorktreeLabels(sibling, branch);
  await app.restartBackend();
  await app.inbox.expandLater();

  await app.inbox.shouldShowWorktreeLabels(title, branch, true);
  await app.inbox.shouldShowWorktreeLabels(sibling, branch);
  await app.browser.setViewport(390, 844);
  await app.inbox.shouldShowWorktreeLabels(title, branch, true);
  await app.inbox.shouldShowWorktreeLabels(sibling, branch);
});

test("linked worktrees show the repository name for live, unloaded and Later rows", async () => {
  await app.tabs.create({ responses: [{ prompt: title, reply: "Setup complete" }] });
  await app.chat.sendPrompt(title);
  await app.chat.shouldShowAssistantReply("Setup complete");
  await app.inbox.setEnabled(true);

  await app.inbox.shouldShowProjectName(title, repositoryName);
  await app.inbox.shouldShowCompactWorktreeLabels(title, branch);

  await app.restartBackend();

  await app.inbox.shouldShowProjectName(title, repositoryName);
  await app.inbox.shouldShowCompactWorktreeLabels(title, branch);
  await app.inbox.parkReady(title);
  await app.inbox.expandLater();

  await app.inbox.shouldShowProjectName(title, repositoryName, true);
  await app.inbox.shouldShowCompactWorktreeLabels(title, branch, true);
  await app.browser.setViewport(390, 844);
  await app.inbox.shouldShowProjectName(title, repositoryName, true);

  await app.inbox.resume(title);

  await app.inbox.shouldShowProjectName(title, repositoryName);
  await app.inbox.shouldShowCompactWorktreeLabels(title, branch);
});

test("linked worktrees keep branch-first labels across running, Ready and Later on desktop and phones", async () => {
  await app.tabs.create({ responses: [
    { prompt: title, reply: "Setup complete" },
    { prompt: "Continue working", reply: "Checks complete", hold: true },
  ] });
  await app.chat.sendPrompt(title);
  await app.chat.shouldShowAssistantReply("Setup complete");
  await app.inbox.setEnabled(true);

  await app.inbox.shouldShowCompactWorktreeLabels(title, branch);
  await app.inbox.shouldHaveTightSectionHeadings({ working: false, later: false });

  await app.chat.sendPrompt("Continue working");
  await app.inbox.shouldBeInSection(title, "Working");

  await app.inbox.shouldShowCompactWorktreeLabels(title, branch);
  await app.inbox.shouldHideRunningActions(title);

  await app.inbox.finishResponse(title);
  await app.inbox.parkCurrent();
  await app.inbox.expandLater();

  await app.inbox.shouldShowCompactWorktreeLabels(title, branch, true);
  await app.browser.setViewport(390, 844);
  await app.inbox.shouldBeDrawer();
  await app.inbox.shouldShowCompactWorktreeLabels(title, branch, true);

  await app.inbox.resume(title);

  await app.inbox.shouldShowCompactWorktreeLabels(title, branch);
});
