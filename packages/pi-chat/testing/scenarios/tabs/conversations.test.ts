import { afterEach, it } from "vitest";
import { PiChatDriver } from "../../infra/pi-chat/pi-chat-driver.js";

let app: PiChatDriver | undefined;

afterEach(async () => {
  await app?.dispose();
  app = undefined;
});

it("creates a real session from home and exchanges a prompt", async () => {
  app = await PiChatDriver.start({ startAtHome: true });

  app.browser.shouldBeAtHome();

  const tab = await app.tabs.create({
    responses: [{ prompt: "Hello", reply: "New conversation." }],
  });

  app.tabs.shouldBeActive(tab);
  app.tabs.shouldHaveCount(1);
  app.chat.shouldHaveMessageCount(0);

  await app.chat.sendPrompt("Hello");
  await app.chat.waitUntilIdle();

  app.chat.shouldHaveAssistantReply("New conversation.");
  app.chat.shouldHaveConsumedResponses();
}, 15000);

it("keeps two conversations independent when switching and reconnecting", async () => {
  app = await PiChatDriver.start({ startAtHome: true });

  const first = await app.tabs.create({
    responses: [
      { prompt: "Same prompt", reply: "First tab." },
      { prompt: "Continue", reply: "Still the first tab." },
    ],
  });

  await app.chat.sendPrompt("Same prompt");
  await app.chat.waitUntilIdle();

  const second = await app.tabs.create({
    responses: [{ prompt: "Same prompt", reply: "Second tab." }],
  });

  app.chat.shouldHaveMessageCount(0);

  await app.chat.sendPrompt("Same prompt");
  await app.chat.waitUntilIdle();
  app.chat.shouldHaveConsumedResponses();

  await app.tabs.switchTo(first);
  app.tabs.shouldBeActive(first);
  app.chat.shouldContainMessages([
    { role: "user", text: "Same prompt" },
    { role: "assistant", text: "First tab." },
  ]);
  app.chat.shouldHaveMessageCount(2);

  await app.browser.reconnect();

  app.tabs.shouldBeActive(first);
  app.tabs.shouldContain([first, second]);
  app.tabs.shouldHaveCount(2);

  await app.chat.sendPrompt("Continue");
  await app.chat.waitUntilIdle();
  app.chat.shouldHaveAssistantReply("Still the first tab.");
  app.chat.shouldHaveMessageCount(4);
  app.chat.shouldHaveConsumedResponses();

  await app.tabs.switchTo(second);
  app.chat.shouldContainMessages([
    { role: "user", text: "Same prompt" },
    { role: "assistant", text: "Second tab." },
  ]);
  app.chat.shouldHaveMessageCount(2);
  app.chat.shouldHaveNoDuplicateMessages();
}, 15000);

it("closes the active tab, preserves the other conversation, and returns home", async () => {
  app = await PiChatDriver.start({ startAtHome: true });

  const first = await app.tabs.create({
    responses: [{ prompt: "Save this", reply: "Kept." }],
  });
  await app.chat.sendPrompt("Save this");
  await app.chat.waitUntilIdle();

  const second = await app.tabs.create();
  await app.tabs.close(second);

  app.browser.shouldBeAtHome();
  app.tabs.shouldContain([first]);
  app.tabs.shouldHaveCount(1);

  await app.tabs.switchTo(first);

  app.tabs.shouldBeActive(first);
  app.tabs.shouldHaveCount(1);
  app.chat.shouldHaveAssistantReply("Kept.");
  app.chat.shouldHaveMessageCount(2);

  await app.tabs.close(first);

  app.tabs.shouldHaveCount(0);
  app.browser.shouldBeAtHome();

  await app.browser.reconnect();
  app.browser.shouldBeAtHome();

  const fresh = await app.tabs.create();
  app.tabs.shouldBeActive(fresh);
  app.chat.shouldHaveMessageCount(0);
}, 15000);

it("closes a background tab without changing the active conversation", async () => {
  app = await PiChatDriver.start({ startAtHome: true });

  const background = await app.tabs.create();
  const active = await app.tabs.create();

  await app.tabs.close(background);

  app.tabs.shouldBeActive(active);
  app.tabs.shouldHaveCount(1);

  // Even same-tab focus waits for a fresh acknowledgement.
  await app.tabs.switchTo(active);
  app.tabs.shouldBeActive(active);
}, 15000);
