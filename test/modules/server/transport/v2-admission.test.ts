import { expect, it, vi } from "vitest";
import { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import { ServerPublisher } from "../../../../src/server/transport/server-publisher.js";
import { executeOperation } from "../../../../src/server/transport/command-handler.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";
it("rejects mutations during an in-place session change before accepting or invoking Pi", async () => {
  const runtime = new FakeRuntimeAdapter(); let release!: () => void;
  vi.spyOn(runtime, "reload").mockImplementation(() => new Promise<void>(resolve => { release = resolve; })); const prompt = vi.spyOn(runtime, "prompt");
  const chat = new ChatApplicationService(runtime, { continueProject: vi.fn(), newSession: vi.fn(), openSession: vi.fn() }); const publisher = new ServerPublisher(chat, () => {});
  const reload = chat.reloadSession("fake-session");
  try { await expect(executeOperation({ version: 2, type: "request", requestId: "r", method: "message.send", params: { message: "no" }, sessionId: publisher.wireId("fake-session") }, chat, publisher)).rejects.toMatchObject({ code: "sessionBusy" }); expect(prompt).not.toHaveBeenCalled(); }
  finally { release(); await reload; await chat.dispose(); }
});
it("does not reject accepted work merely because its subsequent snapshot refresh fails", async () => {
  const runtime = new FakeRuntimeAdapter(); const chat = new ChatApplicationService(runtime, { continueProject: vi.fn(), newSession: vi.fn(), openSession: vi.fn() }); const publisher = new ServerPublisher(chat, () => {});
  vi.spyOn(publisher, "settingsChanged").mockImplementation(() => { throw new Error("refresh failed"); });
  const execution = await executeOperation({ version: 2, type: "request", requestId: "r", method: "message.send", params: { message: "hello" }, sessionId: publisher.wireId("fake-session") }, chat, publisher);
  expect(execution.kind).toBe("accepted"); if (execution.kind === "accepted") await expect(execution.run()).resolves.toBeUndefined(); await chat.dispose();
});
