import { afterEach, describe, it } from "vitest";
import { PiChatDriver } from "../../infra/pi-chat/pi-chat-driver.js";

const apps: PiChatDriver[] = [];
afterEach(async () => { for (const app of apps.splice(0)) await app.dispose(); });

describe("Pi Chat native steering workflows", () => {
  it("queues during a real Pi run, restores on reconnect, and consumes without a duplicate turn", async () => {
    const app = await PiChatDriver.start({ responses: [
      { prompt: "Start working", reply: "First response.", hold: true },
      { prompt: "Use the native queue", reply: "Adjusted direction." },
    ] });
    apps.push(app);
    await app.Chat.SendPrompt("Start working");
    await app.Chat.WaitUntilStreaming();
    await app.Chat.Steer("Use the native queue");
    app.Chat.ShouldHaveQueuedSteering(["Use the native queue"]);
    app.Chat.ShouldHaveMessageCount(1);
    await app.Browser.Reconnect();
    app.Chat.ShouldHaveQueuedSteering(["Use the native queue"]);
    await app.Chat.WaitUntilStreaming();
    app.Chat.ReleaseControlledResponse();
    await app.Chat.WaitUntilIdle();
    app.Chat.ShouldHaveQueuedSteering([]);
    app.Chat.ShouldContainMessages([
      { role: "user", text: "Start working" },
      { role: "assistant", text: "First response." },
      { role: "user", text: "Use the native queue" },
      { role: "assistant", text: "Adjusted direction." },
    ]);
    app.Chat.ShouldHaveMessageCount(4);
    app.Chat.ShouldHaveNoDuplicateMessages();
    app.Chat.ShouldHaveConsumedResponses();
  }, 15000);
});
