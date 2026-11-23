import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
const latestReply = "Latest message at the end of the conversation.";
const longReply = [...Array.from({ length: 60 }, (_, index) => `Transcript paragraph ${index + 1}.`), latestReply].join("\n\n");

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, {});
  await app.inbox.create({ responses: [
    { prompt: "Long conversation", reply: longReply },
    { prompt: "Continue working", reply: "Background completion while reading history.", hold: true },
  ] });
  await app.chat.sendPrompt("Long conversation");
  await app.chat.shouldShowAssistantReply(latestReply);
  await app.chat.shouldBeIdle();
});

test.afterEach(async () => { await app.dispose(); });

test("opening a long conversation from Home shows the latest reply above the composer", async () => {
  await app.inbox.closeView();
  await app.home.shouldBeVisible();

  await app.inbox.openFromInbox("Long conversation");

  await app.chat.shouldShowLatestReplyInViewport(latestReply);
});

test("switching back to a long conversation resets its manual scroll position", async () => {
  await app.chat.shouldShowLatestReplyInViewport(latestReply);
  await app.chat.scrollUpInTranscript();
  await app.inbox.create({ responses: [{ prompt: "Other conversation", reply: "Short reply" }] });
  await app.chat.sendPrompt("Other conversation");
  await app.chat.shouldShowAssistantReply("Short reply");

  await app.inbox.select("Long conversation");

  await app.chat.shouldShowLatestReplyInViewport(latestReply);
});

test("completion does not pull the reader away from earlier messages", async () => {
  await app.chat.shouldShowLatestReplyInViewport(latestReply);
  await app.chat.sendPrompt("Continue working");
  await app.chat.shouldBeSteering();
  await app.chat.scrollUpInTranscript();

  await app.inbox.finishResponse("Long conversation");
  await app.chat.shouldBeIdle();

  await app.chat.shouldKeepReplyOutsideViewport("Background completion while reading history.");
});

test("reloading a long conversation shows its latest reply", async () => {
  await app.chat.shouldShowLatestReplyInViewport(latestReply);
  await app.chat.scrollUpInTranscript();

  await app.browser.reload();

  await app.chat.shouldShowLatestReplyInViewport(latestReply);
});
