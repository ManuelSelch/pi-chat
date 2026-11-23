import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

test("plugin diffs scroll continuously beside chat and support named branch and commit bases",async({page})=>{
  const app = await PiChatBrowserDriver.start(page,{projectBranch:"feature"});
  try {
    await app.changes.prepareChanges();
    await app.sessions.create({responses:[]});
    await app.changes.open();

    await app.changes.shouldShowEveryDiff();
    await app.changes.chooseFile("two.ts");
    await app.changes.shouldKeepSelected("two.ts");
    await app.changes.shouldLeaveChatUsable();

    await app.changes.chooseBranch("main");
    await app.changes.shouldShowBeforeAndAfter();
    await app.changes.chooseCommit("Baseline viewer");
    await app.changes.shouldShowBeforeAndAfter();

    await app.changes.close();
    await app.changes.open();
    await app.changes.shouldRememberCommit("Baseline viewer");
    await app.changes.close();
    await app.changes.shouldBeClosed();
    await app.chat.shouldHaveDraft("Draft beside changes");
  } finally { await app.dispose(); }
});
