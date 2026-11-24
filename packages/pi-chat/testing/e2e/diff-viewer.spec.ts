import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

test("diff readability supports wrapping, fixed gutters and collapsed deleted files",async({page})=>{
  const app = await PiChatBrowserDriver.start(page,{projectBranch:"feature"});
  try {
    await app.changes.prepareLongAndDeletedChanges();
    await app.sessions.create({responses:[]});
    await app.changes.shouldPlaceToggleLast();
    await app.changes.open();

    await app.changes.shouldWrapLongLines();
    await app.changes.toggleWrapping();
    await app.changes.shouldScrollWithConsistentBackgrounds();
    await app.changes.shouldCollapseDeletedFile();
    await app.changes.chooseFile("deleted.ts");
    await app.changes.shouldKeepSelected("deleted.ts");
    await app.changes.expandDeletedFileWithKeyboard();
    await app.changes.shouldHaveNoTooltips();
  } finally { await app.dispose(); }
});

test("plugin diffs scroll continuously beside chat and support named branch and commit bases",async({page})=>{
  const app = await PiChatBrowserDriver.start(page,{projectBranch:"feature"});
  try {
    await app.changes.prepareChanges();
    await app.sessions.create({responses:[]});
    await app.changes.open();

    await app.changes.shouldShowEveryDiff();
    await app.changes.shouldScrollDiffWithoutScrollingChat();
    await app.changes.chooseFile("two.ts");
    await app.changes.shouldKeepSelected("two.ts");
    await app.changes.shouldLeaveChatUsable();

    await app.changes.shouldDefaultToMain();
    await app.changes.shouldShowBeforeAndAfter();
    await app.changes.selectCommitMode();
    await app.changes.shouldShowLatestCommit();
    await app.changes.chooseCommit("Baseline viewer");
    await app.changes.shouldShowInitialCommit();

    await app.changes.close();
    await app.changes.open();
    await app.changes.shouldRememberCommit("Baseline viewer");
    await app.changes.close();
    await app.changes.shouldBeClosed();
    await app.chat.shouldHaveDraft("Draft beside changes");
  } finally { await app.dispose(); }
});
