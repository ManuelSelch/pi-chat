import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

test("Inbox mode keeps navigation and chat available when the general panel must stack",async({page})=>{
  const app = await PiChatBrowserDriver.start(page,{projectBranch:"feature",inboxEnabled:true});
  try {
    await app.changes.useCompactViewport();
    await app.changes.prepareChanges();
    await app.inbox.create({responses:[]});
    await app.inbox.open();
    await app.changes.open();

    await app.changes.shouldShowEveryDiff();
    await app.changes.shouldStackWithoutOverlay();
    await app.chat.editDraft("Draft with stacked changes");
    await app.chat.shouldHaveDraft("Draft with stacked changes");
  } finally { await app.dispose(); }
});
