import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
const repositoryName = "my-project";
const branch = "feature/csmm-6-setup-shadcn";
const title = "Set up shadcn components";
test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, { inboxEnabled: false, repositoryName, projectName: "worktree-labels", projectBranch: branch, linkedWorktree: true });
  await app.Browser.SetViewport(1024);
});
test.afterEach(async () => { await app.dispose(); });

test("a single worktree session uses two lines while retaining title-based discovery and actions", async () => {
  await app.Tabs.Create({ responses: [{ prompt: title, reply: "Setup complete" }] });
  await app.Chat.SendPrompt(title);
  await app.Chat.ShouldShowAssistantReply("Setup complete");
  await app.Inbox.setEnabled(true);

  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch);
  await app.Inbox.shouldHaveNoSearch();
  await app.Inbox.shouldHaveReady(1);

  await app.RestartBackend();

  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch);
  await app.Inbox.parkReady(title);
  await app.Inbox.expandLater();

  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch, true);
  await app.Browser.SetViewport(390, 844);
  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch, true);

  await app.Inbox.resume(title);

  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch);
});

test("shared worktrees retain distinct conversation subtitles across Ready, Later and restart", async () => {
  const sibling = "Review setup checks";
  for (const prompt of [title, sibling]) {
    await app.Tabs.Create({ responses: [{ prompt, reply: "Done" }] });
    await app.Chat.SendPrompt(prompt);
    await app.Chat.ShouldShowAssistantReply("Done");
  }
  await app.Inbox.setEnabled(true);

  await app.Inbox.shouldShowWorktreeLabels(title, branch);
  await app.Inbox.shouldShowWorktreeLabels(sibling, branch);
  await app.Inbox.parkReady(title);
  await app.Inbox.expandLater();

  await app.Inbox.shouldShowWorktreeLabels(title, branch, true);
  await app.Inbox.shouldShowWorktreeLabels(sibling, branch);
  await app.RestartBackend();
  await app.Inbox.expandLater();

  await app.Inbox.shouldShowWorktreeLabels(title, branch, true);
  await app.Inbox.shouldShowWorktreeLabels(sibling, branch);
  await app.Browser.SetViewport(390, 844);
  await app.Inbox.shouldShowWorktreeLabels(title, branch, true);
  await app.Inbox.shouldShowWorktreeLabels(sibling, branch);
});

test("linked worktrees show the repository name for live, unloaded and Later rows", async () => {
  await app.Tabs.Create({ responses: [{ prompt: title, reply: "Setup complete" }] });
  await app.Chat.SendPrompt(title);
  await app.Chat.ShouldShowAssistantReply("Setup complete");
  await app.Inbox.setEnabled(true);

  await app.Inbox.shouldShowProjectName(title, repositoryName);
  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch);

  await app.RestartBackend();

  await app.Inbox.shouldShowProjectName(title, repositoryName);
  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch);
  await app.Inbox.parkReady(title);
  await app.Inbox.expandLater();

  await app.Inbox.shouldShowProjectName(title, repositoryName, true);
  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch, true);
  await app.Browser.SetViewport(390, 844);
  await app.Inbox.shouldShowProjectName(title, repositoryName, true);

  await app.Inbox.resume(title);

  await app.Inbox.shouldShowProjectName(title, repositoryName);
  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch);
});

test("linked worktrees keep branch-first labels across running, Ready and Later on desktop and phones", async () => {
  await app.Tabs.Create({ responses: [
    { prompt: title, reply: "Setup complete" },
    { prompt: "Continue working", reply: "Checks complete", hold: true },
  ] });
  await app.Chat.SendPrompt(title);
  await app.Chat.ShouldShowAssistantReply("Setup complete");
  await app.Inbox.setEnabled(true);

  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch);
  await app.Inbox.shouldHaveTightSectionHeadings({ working: false, later: false });

  await app.Chat.SendPrompt("Continue working");
  await app.Inbox.shouldBeInSection(title, "Working");

  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch);
  await app.Inbox.shouldHideRunningActions(title);

  await app.Inbox.finishResponse(title);
  await app.Inbox.parkCurrent();
  await app.Inbox.expandLater();

  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch, true);
  await app.Browser.SetViewport(390, 844);
  await app.Inbox.shouldBeDrawer();
  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch, true);

  await app.Inbox.resume(title);

  await app.Inbox.shouldShowCompactWorktreeLabels(title, branch);
});
