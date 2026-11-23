import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

test("a narrow workspace shows changes separately and restores the chat draft",async({page})=>{
  const app = await PiChatBrowserDriver.start(page,{projectBranch:"feature",inboxEnabled:true});
  try {
    await app.changes.useCompactViewport();
    await app.changes.prepareChanges();
    await app.changes.shouldBeUnavailable();
    await app.inbox.create({responses:[]});
    await app.inbox.open();
    await app.chat.editDraft("Draft before changes");
    await app.changes.open();

    await app.changes.shouldShowEveryDiff();
    await app.changes.shouldShowFullWidthView();
    await app.changes.shouldScrollDiffWithoutScrollingChat();
    await app.changes.close();
    await app.chat.shouldHaveDraft("Draft before changes");
    await app.changes.open();
    await app.inbox.closeView();
    await app.changes.shouldBeUnavailable();
    await app.inbox.create({responses:[]});
    await app.changes.shouldBeAvailableAndClosed();
  } finally { await app.dispose(); }
});
