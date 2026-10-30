import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
const branch = "feature/csmm-6-setup-shadcn";
const title = "Set up shadcn components";
test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, { projectName: "worktree-labels", projectBranch: branch, linkedWorktree: true });
  await app.Browser.SetViewport(1024);
});
test.afterEach(async () => { await app.dispose(); });

test("linked worktrees keep branch-first labels across running, Ready and Later on desktop and phones", async () => {
  await app.Tabs.Create({ responses: [
    { prompt: title, reply: "Setup complete" },
    { prompt: "Continue working", reply: "Checks complete", hold: true },
  ] });
  await app.Chat.SendPrompt(title);
  await app.Chat.ShouldShowAssistantReply("Setup complete");
  await app.Inbox.setEnabled(true);

  await app.Inbox.shouldShowWorktreeLabels(title, branch);
  await app.Inbox.shouldHaveTightSectionHeadings();

  await app.Chat.SendPrompt("Continue working");
  await app.Inbox.shouldBeInSection(title, "Working");

  await app.Inbox.shouldShowWorktreeLabels(title, branch);
  await app.Inbox.shouldHideRunningActions(title);

  await app.Inbox.finishResponse(title);
  await app.Inbox.parkCurrent();
  await app.Inbox.expandLater();

  await app.Inbox.shouldShowWorktreeLabels(title, branch, true);
  await app.Browser.SetViewport(390, 844);
  await app.Inbox.shouldBeDrawer();
  await app.Inbox.shouldShowWorktreeLabels(title, branch, true);

  await app.Inbox.resume(title);

  await app.Inbox.shouldShowWorktreeLabels(title, branch);
});
