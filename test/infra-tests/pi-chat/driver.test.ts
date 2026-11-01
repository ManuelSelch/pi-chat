import { afterEach, expect, it, vi } from "vitest";
import { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { BrowserClient } from "../../infra/pi-chat/browser-client.js";
import { TestWorld } from "../../infra/pi-chat/test-world.js";
import { PiChatDriver } from "../../infra/pi-chat/pi-chat-driver.js";

let app: PiChatDriver | undefined;
afterEach(async () => {
  try { await app?.dispose(); }
  finally { app = undefined; vi.restoreAllMocks(); }
});

it("reports semantic assertions with current browser state and recent messages", async () => {
  app = await PiChatDriver.start({ responses: [{ prompt: "Hello", reply: "Hi." }] });
  expect(() => app!.chat.shouldHaveAssistantReply("Missing")).toThrow(/Chat.ShouldHaveAssistantReply:.*activeSessionId.*recentMessages/);
  expect(() => app!.chat.shouldHaveConsumedResponses()).toThrow(/Unused scripted responses/);
});

it("fails an unscripted model turn without falling back to a real provider", async () => {
  app = await PiChatDriver.start();
  await expect(app.chat.sendPrompt("An unexpected prompt")).rejects.toThrow(/Chat.SendPrompt:.*No scripted response/);
  app.chat.shouldHaveMessageCount(0);
});

it("rejects a mismatched prompt without consuming the response", async () => {
  app = await PiChatDriver.start({ responses: [{ prompt: "Expected", reply: "Correct reply." }] });
  await expect(app.chat.sendPrompt("Different")).rejects.toThrow(/Prompt does not match/);
  app.chat.shouldHaveMessageCount(0);
  await app.chat.sendPrompt("Expected");
  await app.chat.waitUntilIdle();
  app.chat.shouldHaveAssistantReply("Correct reply.");
  app.chat.shouldHaveConsumedResponses();
});

it("can dispose twice and start a fresh isolated world", async () => {
  app = await PiChatDriver.start();
  await app.dispose();
  await app.dispose();
  app = await PiChatDriver.start();
  app.browser.shouldBeUsable();
  app.chat.shouldHaveMessageCount(0);
});

it("cleans up the runtime and client if startup cannot obtain a snapshot", async () => {
  vi.spyOn(BrowserClient.prototype, "ready").mockRejectedValueOnce(new Error("Injected startup failure"));
  const close = vi.spyOn(BrowserClient.prototype, "close");
  const dispose = vi.spyOn(AgentSessionRuntime.prototype, "dispose");
  await expect(PiChatDriver.start()).rejects.toThrow("Injected startup failure");
  expect(close).toHaveBeenCalledTimes(1);
  expect(dispose).toHaveBeenCalledTimes(1);
  app = await PiChatDriver.start();
  app.browser.shouldBeUsable();
});

it("reports failed tab creation and releases its script reservation for retry", async () => {
  app = await PiChatDriver.start({ startAtHome: true });
  vi.spyOn(TestWorld.prototype, "create").mockRejectedValueOnce(new Error("Injected session creation failure"));
  await expect(app.tabs.create()).rejects.toThrow(/Tabs.Create:.*The server operation failed.*recentMessages/);
  app.browser.shouldShowError("The server operation failed."); app.browser.dismissError();
  app.browser.shouldBeAtHome();
  const tab = await app.tabs.create({ responses: [{ prompt: "Retry", reply: "Recovered." }] });
  app.tabs.shouldBeActive(tab);
  await app.chat.sendPrompt("Retry");
  await app.chat.waitUntilIdle();
  app.chat.shouldHaveAssistantReply("Recovered.");
  app.chat.shouldHaveConsumedResponses();
});

it("rejects closed handles instead of silently focusing or closing another tab", async () => {
  app = await PiChatDriver.start({ startAtHome: true });
  const tab = await app.tabs.create();
  await app.tabs.close(tab);
  await expect(app.tabs.switchTo(tab)).rejects.toThrow(/Tabs.SwitchTo:.*already closed/);
  await expect(app.tabs.close(tab)).rejects.toThrow(/Tabs.Close:.*already closed/);
  app.browser.shouldBeAtHome();
});

it("rejects home-start scripts that would otherwise be silently discarded", async () => {
  await expect(PiChatDriver.start({ startAtHome: true, responses: [{ prompt: "Lost", reply: "Unused" }] })).rejects.toThrow(/Supply home-start response scripts to Tabs.Create/);
});

it("rejects invalid timeout configuration before allocating resources", async () => {
  await expect(PiChatDriver.start({ timeoutMs: 0 })).rejects.toThrow("timeoutMs must be positive and finite");
});
