import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

test("inline comments survive panel toggles and send one contextual batch without changing the composer",async({page})=>{
  const app=await PiChatBrowserDriver.start(page,{projectBranch:"feature"});
  try {
    await app.changes.prepareChanges();
    const batch=await app.changes.expectedReviewBatch();
    await app.sessions.create({responses:[{prompt:batch,reply:"Feedback received."}]});
    await app.chat.editDraft("Keep my chat draft");
    await app.changes.open();

    await app.changes.beginCommentDraft("one.ts","Unfinished note");
    await app.changes.close();
    await app.changes.open();
    await app.changes.shouldHaveCommentDraft("Unfinished note");
    await app.changes.cancelComment();
    await app.changes.addLineComment("one.ts","Initial note");
    await app.changes.editComment("Initial note","Handle the empty case.");
    await app.changes.addLineComment("two.ts","Keep validation.");
    await app.changes.shouldHaveComments(2);
    await app.changes.close();
    await app.changes.open();
    await app.changes.shouldHaveComments(2);
    await app.changes.filterFiles("one.ts");
    await app.changes.shouldHaveComments(2);
    await app.changes.sendComments();

    await app.changes.shouldClearSubmittedComments();
    await app.changes.shouldShowBatchOnce(batch);
    await app.chat.shouldShowAssistantReply("Feedback received.");
    await app.chat.shouldHaveDraft("Keep my chat draft");
  } finally { await app.dispose(); }
});

test("file kinds preserve folder structure and filter the continuous diff stream",async({page})=>{
  const app = await PiChatBrowserDriver.start(page,{projectBranch:"feature"});
  try {
    await app.changes.prepareGroupedChanges();
    await app.sessions.create({responses:[]});
    await app.changes.open();

    await app.changes.shouldGroupByKind();
    await app.changes.collapseSourceGroup();
    await app.changes.shouldCollapseNavigationOnly();
    await app.changes.filterFiles("CHECKOUT");
    await app.changes.shouldShowFilteredCheckoutChanges();
    await app.changes.chooseFile("tests/e2e/checkout.spec.ts");
    await app.changes.shouldKeepSelected("tests/e2e/checkout.spec.ts");
    await app.changes.filterFiles("no-matching-path");
    await app.changes.shouldKeepUnmatchedFilterUsable();
    await app.changes.filterFiles("");
    await app.changes.shouldRestoreAllGroupedChanges();
  } finally { await app.dispose(); }
});

test("large comparisons highlight on demand and keep generated files responsive",async({page})=>{
  const app = await PiChatBrowserDriver.start(page,{projectBranch:"feature"});
  try {
    await app.changes.prepareManyChanges();
    await app.sessions.create({responses:[]});
    await app.changes.open();

    await app.changes.shouldDeferOffscreenHighlighting();
    await app.changes.chooseFile("perf-00.ts");
    await app.changes.shouldHighlightSelectedFile();
    await app.changes.shouldDeferOffscreenHighlighting();
    await app.changes.chooseFile("zz-generated.ts");
    await app.changes.shouldKeepGeneratedFileReadable();
    await app.changes.shouldScrollLargeDiffSmoothly();
    await app.changes.close();
    await app.changes.shouldBeClosed();
    await app.changes.shouldUseBundledWorkers();
  } finally { await app.dispose(); }
});

test("diff readability supports wrapping, fixed gutters and collapsed deleted files",async({page})=>{
  const app = await PiChatBrowserDriver.start(page,{projectBranch:"feature"});
  try {
    await app.changes.prepareLongAndDeletedChanges();
    await app.sessions.create({responses:[]});
    await app.changes.shouldPlaceToggleLast();
    await app.changes.open();

    await app.changes.shouldWrapLongLines();
    await app.changes.shouldUseCompactDiffLabels();
    await app.changes.shouldHighlightSyntax();
    await app.changes.toggleWrapping();
    await app.changes.shouldScrollWithConsistentBackgrounds();
    await app.changes.shouldHighlightSyntax();
    await app.changes.shouldCollapseDeletedFile();
    await app.changes.chooseFile("deleted.ts");
    await app.changes.shouldKeepSelected("deleted.ts");
    await app.changes.expandDeletedFileWithKeyboard();
    await app.changes.shouldHaveNoTooltips();
    await app.changes.shouldRenderHtmlSafely();
  } finally { await app.dispose(); }
});

test("comparison pickers keep the base visible, support keyboard search and limit recent commits",async({page})=>{
  const app = await PiChatBrowserDriver.start(page,{projectBranch:"feature"});
  try {
    await app.changes.preparePickerChoices();
    await app.sessions.create({responses:[]});
    await app.changes.open();

    await app.changes.shouldSearchBranchesWithKeyboard();
    await app.changes.selectCommitMode();
    await app.changes.shouldOfferOnlyFiveRecentCommits();
    await app.changes.chooseCommit("Recent change 2");
    await app.changes.close();
    await app.changes.open();
    await app.changes.shouldRememberCommit("Recent change 2");
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
