import { afterEach, it } from "vitest";
import { PiChatDriver } from "./support/pi-chat/pi-chat-driver.js";

let app: PiChatDriver | undefined;
afterEach(async () => { await app?.dispose(); app = undefined; });

it("creates a real session from home and exchanges a prompt", async () => {
  app = await PiChatDriver.start({ startAtHome: true });
  app.Browser.ShouldBeAtHome();
  const tab = await app.Tabs.Create({ responses: [{ prompt: "Hello", reply: "New conversation." }] });
  app.Tabs.ShouldBeActive(tab);
  app.Tabs.ShouldHaveCount(1);
  app.Chat.ShouldHaveMessageCount(0);
  await app.Chat.SendPrompt("Hello");
  await app.Chat.WaitUntilIdle();
  app.Chat.ShouldHaveAssistantReply("New conversation.");
  app.Chat.ShouldHaveConsumedResponses();
}, 15000);

it("keeps two conversations independent when switching and reconnecting", async () => {
  app = await PiChatDriver.start({ startAtHome: true });
  const first = await app.Tabs.Create({ responses: [
    { prompt: "Same prompt", reply: "First tab." },
    { prompt: "Continue", reply: "Still the first tab." },
  ] });
  await app.Chat.SendPrompt("Same prompt");
  await app.Chat.WaitUntilIdle();
  const second = await app.Tabs.Create({ responses: [{ prompt: "Same prompt", reply: "Second tab." }] });
  app.Chat.ShouldHaveMessageCount(0);
  await app.Chat.SendPrompt("Same prompt");
  await app.Chat.WaitUntilIdle();
  app.Chat.ShouldHaveConsumedResponses();
  await app.Tabs.SwitchTo(first);
  app.Tabs.ShouldBeActive(first);
  app.Chat.ShouldContainMessages([
    { role: "user", text: "Same prompt" }, { role: "assistant", text: "First tab." },
  ]);
  app.Chat.ShouldHaveMessageCount(2);
  await app.Browser.Reconnect();
  app.Tabs.ShouldBeActive(first);
  app.Tabs.ShouldContain([first, second]);
  app.Tabs.ShouldHaveCount(2);
  await app.Chat.SendPrompt("Continue");
  await app.Chat.WaitUntilIdle();
  app.Chat.ShouldHaveAssistantReply("Still the first tab.");
  app.Chat.ShouldHaveMessageCount(4);
  app.Chat.ShouldHaveConsumedResponses();
  await app.Tabs.SwitchTo(second);
  app.Chat.ShouldContainMessages([
    { role: "user", text: "Same prompt" }, { role: "assistant", text: "Second tab." },
  ]);
  app.Chat.ShouldHaveMessageCount(2);
  app.Chat.ShouldHaveNoDuplicateMessages();
}, 15000);

it("closes the active tab, preserves the other conversation, and returns home", async () => {
  app = await PiChatDriver.start({ startAtHome: true });
  const first = await app.Tabs.Create({ responses: [{ prompt: "Save this", reply: "Kept." }] });
  await app.Chat.SendPrompt("Save this");
  await app.Chat.WaitUntilIdle();
  const second = await app.Tabs.Create();
  await app.Tabs.Close(second);
  app.Tabs.ShouldBeActive(first);
  app.Tabs.ShouldHaveCount(1);
  app.Chat.ShouldHaveAssistantReply("Kept.");
  app.Chat.ShouldHaveMessageCount(2);
  await app.Tabs.Close(first);
  app.Tabs.ShouldHaveCount(0);
  app.Browser.ShouldBeAtHome();
  await app.Browser.Reconnect();
  app.Browser.ShouldBeAtHome();
  const fresh = await app.Tabs.Create();
  app.Tabs.ShouldBeActive(fresh);
  app.Chat.ShouldHaveMessageCount(0);
}, 15000);

it("closes a background tab without changing the active conversation", async () => {
  app = await PiChatDriver.start({ startAtHome: true });
  const background = await app.Tabs.Create();
  const active = await app.Tabs.Create();
  await app.Tabs.Close(background);
  app.Tabs.ShouldBeActive(active);
  app.Tabs.ShouldHaveCount(1);
  await app.Tabs.SwitchTo(active); // Even same-tab focus waits for a fresh ACK.
  app.Tabs.ShouldBeActive(active);
}, 15000);
