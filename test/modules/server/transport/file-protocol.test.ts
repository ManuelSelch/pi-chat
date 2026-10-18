import { describe, expect, it, vi } from "vitest";
import { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import { executeOperation } from "../../../../src/server/transport/command-handler.js";
import { ServerPublisher } from "../../../../src/server/transport/server-publisher.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";

function fixture() {
  const chat = new ChatApplicationService(new FakeRuntimeAdapter(), { continueProject: vi.fn(), openSession: vi.fn(), newSession: vi.fn() });
  const send = vi.fn(); const publisher = new ServerPublisher(chat, send);
  const request = { version: 2 as const, type: "request" as const, method: "file.open" as const, sessionId: publisher.wireId("fake-session"), requestId: "file-1", params: { path: "report.pdf" } };
  return { chat, publisher, send, request };
}
describe("v2 file command dispatch", () => {
  it("returns completion without publishing transcript or inventory", async () => {
    const { chat, publisher, send, request } = fixture();
    const open = vi.spyOn(chat, "openFile").mockResolvedValue({ ok: true });
    expect(await executeOperation(request, chat, publisher)).toMatchObject({ kind: "completed", result: { state: "completed" } });
    expect(open).toHaveBeenCalledWith("fake-session", "report.pdf"); expect(send).not.toHaveBeenCalled(); await chat.dispose();
  });
  it("preserves structured file failures without publishing runtime errors", async () => {
    const { chat, publisher, send, request } = fixture();
    vi.spyOn(chat, "openFile").mockResolvedValue({ ok: false, error: { code: "notFound", message: "File not found on the server." } });
    await expect(executeOperation(request, chat, publisher)).rejects.toMatchObject({ code: "notFound" });
    expect(send).not.toHaveBeenCalled(); await chat.dispose();
  });
  it("rejects stale identity before file access", async () => {
    const { chat, publisher, request } = fixture(); const open = vi.spyOn(chat, "openFile");
    await expect(executeOperation({ ...request, sessionId: "stale" }, chat, publisher)).rejects.toMatchObject({ code: "sessionNotFound" });
    expect(open).not.toHaveBeenCalled(); await chat.dispose();
  });
  it("sanitizes unexpected file exceptions", async () => {
    const { chat, publisher, request } = fixture();
    vi.spyOn(chat, "openFile").mockRejectedValue(new Error("private internals"));
    await expect(executeOperation(request, chat, publisher)).rejects.toMatchObject({ code: "operationFailed", message: "The server operation failed." }); await chat.dispose();
  });
});
