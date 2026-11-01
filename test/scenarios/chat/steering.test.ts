import { afterEach, describe, it } from "vitest";
import { PiChatDriver } from "../../infra/pi-chat/pi-chat-driver.js";

const apps: PiChatDriver[] = [];
afterEach(async () => { for (const app of apps.splice(0)) await app.dispose(); });

describe("Pi Chat native steering workflows", () => {
  it("runs an extension command immediately without interrupting a real Pi stream", async () => {
    const app = await PiChatDriver.start({
      responses: [{ prompt: "Start working", reply: "Completed normally.", hold: true }],
      extensions: [pi => {
        pi.registerCommand("stream-status", {
          handler: async (_, ctx) => { ctx.ui.notify("Command ran during streaming", "info"); },
        });
      }],
    });
    apps.push(app);
    await app.chat.sendPrompt("Start working");
    await app.chat.waitUntilStreaming();
    await app.extensions.runCommand("stream-status");
    app.extensions.shouldShowNotification("Command ran during streaming");
    app.chat.shouldHaveQueuedSteering([]);
    await app.chat.waitUntilStreaming();
    await app.browser.reconnect();
    await app.chat.waitUntilStreaming();
    app.chat.releaseControlledResponse();
    await app.chat.waitUntilIdle();
    app.chat.shouldHaveAssistantReply("Completed normally.");
    app.chat.shouldHaveConsumedResponses();
  }, 15000);

  it("queues during a real Pi run, restores on reconnect, and consumes without a duplicate turn", async () => {
    const app = await PiChatDriver.start({ responses: [
      { prompt: "Start working", reply: "First response.", hold: true },
      { prompt: "Use the native queue", reply: "Adjusted direction." },
    ] });
    apps.push(app);
    await app.chat.sendPrompt("Start working");
    await app.chat.waitUntilStreaming();
    await app.chat.steer("Use the native queue");
    app.chat.shouldHaveQueuedSteering(["Use the native queue"]);
    app.chat.shouldHaveMessageCount(1);
    await app.browser.reconnect();
    app.chat.shouldHaveQueuedSteering(["Use the native queue"]);
    app.chat.shouldHaveMessageCount(1);
    await app.chat.waitUntilStreaming();
    app.chat.releaseControlledResponse();
    await app.chat.waitUntilIdle();
    app.chat.shouldHaveQueuedSteering([]);
    app.chat.shouldContainMessages([
      { role: "user", text: "Start working" },
      { role: "assistant", text: "First response." },
      { role: "user", text: "Use the native queue" },
      { role: "assistant", text: "Adjusted direction." },
    ]);
    app.chat.shouldHaveMessageCount(4);
    app.chat.shouldHaveNoDuplicateMessages();
    app.chat.shouldHaveConsumedResponses();
    await app.browser.reconnect();
    app.chat.shouldHaveQueuedSteering([]);
    app.chat.shouldHaveMessageCount(4);
    app.chat.shouldContainMessages([
      { role: "user", text: "Start working" },
      { role: "assistant", text: "First response." },
      { role: "user", text: "Use the native queue" },
      { role: "assistant", text: "Adjusted direction." },
    ]);
  }, 15000);

  it("preserves two identical queued inputs and consumes both without synthetic bubbles", async () => {
    const app = await PiChatDriver.start({ responses: [
      { prompt: "Start working", reply: "First response.", hold: true },
      { prompt: "Same direction", reply: "First adjustment." },
      { prompt: "Same direction", reply: "Second adjustment." },
    ] });
    apps.push(app);
    await app.chat.sendPrompt("Start working");
    await app.chat.waitUntilStreaming();
    await app.chat.steer("Same direction");
    await app.chat.steer("Same direction");
    app.chat.shouldHaveQueuedSteering(["Same direction", "Same direction"]);
    app.chat.shouldHaveMessageCount(1);
    await app.browser.reconnect();
    app.chat.shouldHaveQueuedSteering(["Same direction", "Same direction"]);
    app.chat.shouldHaveMessageCount(1);
    app.chat.releaseControlledResponse();
    await app.chat.waitUntilIdle();
    app.chat.shouldHaveQueuedSteering([]);
    app.chat.shouldContainMessages([
      { role: "user", text: "Start working" },
      { role: "assistant", text: "First response." },
      { role: "user", text: "Same direction" },
      { role: "assistant", text: "First adjustment." },
      { role: "user", text: "Same direction" },
      { role: "assistant", text: "Second adjustment." },
    ]);
    app.chat.shouldHaveMessageCount(6);
    app.chat.shouldHaveNoDuplicateMessages();
    app.chat.shouldHaveConsumedResponses();
    await app.browser.reconnect();
    app.chat.shouldHaveQueuedSteering([]);
    app.chat.shouldHaveMessageCount(6);
    app.chat.shouldHaveNoDuplicateMessages();
  }, 15000);
});
