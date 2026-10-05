import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import { handleClientCommand } from "../../../../src/server/transport/command-handler.js";
import { ServerPublisher } from "../../../../src/server/transport/server-publisher.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";
import { parseClientMessage } from "../../../../src/shared/protocol.js";
import type { FileOpenResult } from "../../../../src/shared/files.js";

const request = parseClientMessage({ version: 1, type: "openFile", sessionId: "fake-session", requestId: "file-1", path: "report.pdf" });
function fixture() {
  const chat = new ChatApplicationService(new FakeRuntimeAdapter(), { continueProject: vi.fn(), openSession: vi.fn(), newSession: vi.fn() });
  const socket = { readyState: WebSocket.OPEN, send: vi.fn() } as unknown as WebSocket;
  const other = { readyState: WebSocket.OPEN, send: vi.fn() } as unknown as WebSocket;
  let controller = socket;
  const publisher = new ServerPublisher(chat, () => controller);
  const effects = [vi.spyOn(publisher, "sendSnapshot"), vi.spyOn(publisher, "sendTabs"), vi.spyOn(publisher, "sendCatalogue"), vi.spyOn(publisher, "publishError")];
  const dependencies = { chat, publisher, isController: (candidate: WebSocket) => candidate === controller, openTab: vi.fn() };
  return { chat, socket, other, effects, dependencies, replaceController: () => { controller = other; } };
}

const settle = async () => { await new Promise<void>((resolve) => setImmediate(resolve)); };
describe("file command dispatch", () => {
  it.each([true, false])("replies only to the requester without publishing any state (success=%s)", async (ok) => {
    const { chat, socket, other, effects, dependencies } = fixture();
    const result: FileOpenResult = ok ? { ok: true } : { ok: false, error: { code: "notFound", message: "File not found on the server." } };
    const open = vi.spyOn(chat, "openFile").mockResolvedValue(result);
    handleClientCommand(socket, request, dependencies);
    await settle();
    expect(open).toHaveBeenCalledWith("fake-session", "report.pdf");
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(socket.send).mock.calls[0]![0] as string)).toEqual({ version: 1, type: "fileOpenResult", sessionId: "fake-session", requestId: "file-1", result });
    expect(other.send).not.toHaveBeenCalled();
    for (const effect of effects) expect(effect).not.toHaveBeenCalled();
    await chat.dispose();
  });

  it("enforces controller ownership before accessing files", async () => {
    const { chat, other, socket, dependencies } = fixture();
    const open = vi.spyOn(chat, "openFile");
    handleClientCommand(other, request, dependencies);
    await settle();
    expect(open).not.toHaveBeenCalled();
    expect(socket.send).not.toHaveBeenCalled();
    expect(other.send).not.toHaveBeenCalled();
    await chat.dispose();
  });

  it("correlates synchronous failures without runtime errors or leaking exception text", async () => {
    const { chat, socket, dependencies, effects } = fixture();
    vi.spyOn(chat, "openFile").mockImplementation(() => { throw new Error("private internals"); });
    handleClientCommand(socket, request, dependencies);
    await settle();
    expect(JSON.parse(vi.mocked(socket.send).mock.calls[0]![0] as string)).toMatchObject({ type: "fileOpenResult", sessionId: "fake-session", requestId: "file-1", result: { ok: false, error: { code: "openFailed" } } });
    expect(vi.mocked(socket.send).mock.calls[0]![0]).not.toContain("private internals");
    for (const effect of effects) expect(effect).not.toHaveBeenCalled();
    await chat.dispose();
  });

  it("never retargets a late result after controller replacement", async () => {
    const { chat, socket, other, dependencies, replaceController } = fixture();
    let finish!: (value: FileOpenResult) => void;
    vi.spyOn(chat, "openFile").mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    handleClientCommand(socket, request, dependencies);
    await settle();
    replaceController();
    finish({ ok: true });
    await settle();
    expect(socket.send).not.toHaveBeenCalled();
    expect(other.send).not.toHaveBeenCalled();
    await chat.dispose();
  });
});
