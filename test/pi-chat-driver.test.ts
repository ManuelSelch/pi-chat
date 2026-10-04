import { afterEach, expect, it, vi } from "vitest";
import { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { BrowserClient } from "./support/pi-chat/browser-client.js";
import { PiChatDriver } from "./support/pi-chat/pi-chat-driver.js";

let app: PiChatDriver | undefined;
afterEach(async () => {
  try { await app?.dispose(); }
  finally { app = undefined; vi.restoreAllMocks(); }
});

it("reports semantic assertions with current browser state and recent messages", async () => {
  app = await PiChatDriver.start({ responses: [{ prompt: "Hello", reply: "Hi." }] });
  expect(() => app!.Chat.ShouldHaveAssistantReply("Missing")).toThrow(/Chat.ShouldHaveAssistantReply:.*activeSessionId.*recentMessages/);
  expect(() => app!.Chat.ShouldHaveConsumedResponses()).toThrow(/Unused scripted responses/);
});

it("fails an unscripted model turn without falling back to a real provider", async () => {
  app = await PiChatDriver.start();
  await expect(app.Chat.SendPrompt("An unexpected prompt")).rejects.toThrow(/Chat.SendPrompt:.*No scripted response/);
  app.Chat.ShouldHaveMessageCount(0);
});

it("rejects a mismatched prompt without consuming the response", async () => {
  app = await PiChatDriver.start({ responses: [{ prompt: "Expected", reply: "Correct reply." }] });
  await expect(app.Chat.SendPrompt("Different")).rejects.toThrow(/Prompt does not match/);
  app.Chat.ShouldHaveMessageCount(0);
  await app.Chat.SendPrompt("Expected");
  await app.Chat.WaitUntilIdle();
  app.Chat.ShouldHaveAssistantReply("Correct reply.");
  app.Chat.ShouldHaveConsumedResponses();
});

it("can dispose twice and start a fresh isolated world", async () => {
  app = await PiChatDriver.start();
  await app.dispose();
  await app.dispose();
  app = await PiChatDriver.start();
  app.Browser.ShouldBeUsable();
  app.Chat.ShouldHaveMessageCount(0);
});

it("cleans up the runtime and client if startup cannot obtain a snapshot", async () => {
  vi.spyOn(BrowserClient.prototype, "ready").mockRejectedValueOnce(new Error("Injected startup failure"));
  const close = vi.spyOn(BrowserClient.prototype, "close");
  const dispose = vi.spyOn(AgentSessionRuntime.prototype, "dispose");
  await expect(PiChatDriver.start()).rejects.toThrow("Injected startup failure");
  expect(close).toHaveBeenCalledTimes(1);
  expect(dispose).toHaveBeenCalledTimes(1);
  app = await PiChatDriver.start();
  app.Browser.ShouldBeUsable();
});

it("rejects invalid timeout configuration before allocating resources", async () => {
  await expect(PiChatDriver.start({ timeoutMs: 0 })).rejects.toThrow("timeoutMs must be positive and finite");
});
