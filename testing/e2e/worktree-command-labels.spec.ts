import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";
import { worktreeCommandFixture } from "../infra/pi-chat/fixtures/worktree-command-fixture.js";

let app: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, {
    inboxEnabled: false, projectName: "command-repository", projectBranch: "main",
    extensions: [worktreeCommandFixture],
  });
  await app.browser.setViewport(1024);
});
test.afterEach(async () => { await app.dispose(); });

test("creating a worktree via a slash command updates labels before the first message", async () => {
  await app.tabs.create({ responses: [] });
  await app.inbox.setEnabled(true);

  await app.chat.sendPrompt("/worktree create feature/new-checkout");

  await app.inbox.shouldShowWorktreeSession("command-repository", "feature/new-checkout");
  await app.quickOpen.open();
  await app.quickOpen.shouldShowWorktreeSession("command-repository", "feature/new-checkout");
});
