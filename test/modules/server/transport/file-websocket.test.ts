import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { createPiChatServer, type PiChatServer } from "../../../../src/server/bootstrap/server.js";
import { FileService } from "../../../../src/server/files/file-service.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";
import { serverMessageSchema, type ServerMessage } from "../../../../src/shared/protocol.js";

let server: PiChatServer | undefined;
let socket: WebSocket | undefined;
let folder: string | undefined;
afterEach(async () => {
  socket?.close();
  await server?.close();
  if (folder) await rm(folder, { recursive: true, force: true });
  server = undefined; socket = undefined; folder = undefined;
});
function receive(type: ServerMessage["type"]): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket!.off("message", listener); reject(new Error(`Timed out waiting for ${type}`)); }, 2000);
    const listener = (data: WebSocket.RawData) => {
      const message = serverMessageSchema.parse(JSON.parse(data.toString()));
      if (message.type === type) { clearTimeout(timer); socket!.off("message", listener); resolve(message); }
    };
    socket!.on("message", listener);
  });
}

describe("file WebSocket integration", () => {
  it("opens during a run and returns success/missing-session errors without history or state traffic", async () => {
    folder = await mkdtemp(join(tmpdir(), "pi-file-websocket-"));
    await writeFile(join(folder, "harmless.pdf"), "fixture");
    const runtime = new FakeRuntimeAdapter();
    const original = runtime.snapshot();
    vi.spyOn(runtime, "snapshot").mockReturnValue({ ...original, projectPath: folder, isStreaming: true });
    const prompt = vi.spyOn(runtime, "prompt");
    const abort = vi.spyOn(runtime, "abort");
    const opener = { open: vi.fn(async (_path: string) => {}) };
    server = createPiChatServer(runtime, undefined, { continueProject: vi.fn(), openSession: vi.fn(), newSession: vi.fn() }, undefined, undefined, new FileService(opener));
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    socket = new WebSocket(`ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`);
    await receive("catalogue");
    const traffic: ServerMessage[] = [];
    socket.on("message", (data) => traffic.push(serverMessageSchema.parse(JSON.parse(data.toString()))));
    const send = async (requestId: string, path: string, sessionId = original.sessionId) => {
      const reply = receive("fileOpenResult");
      socket!.send(JSON.stringify({ version: 1, type: "openFile", requestId, sessionId, path }));
      return reply;
    };
    expect(await send("open-1", "harmless.pdf")).toMatchObject({ type: "fileOpenResult", sessionId: original.sessionId, requestId: "open-1", result: { ok: true } });
    expect(opener.open).toHaveBeenCalledWith(await realpath(join(folder, "harmless.pdf")));
    expect(await send("missing-file", "missing.pdf")).toMatchObject({ requestId: "missing-file", result: { ok: false, error: { code: "notFound" } } });
    expect(await send("missing-session", "harmless.pdf", "closed-session")).toMatchObject({ sessionId: "closed-session", requestId: "missing-session", result: { ok: false, error: { code: "sessionUnavailable" } } });
    // Allow queued writes to arrive before checking the absence of side effects.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(traffic.map((message) => message.type)).toEqual(["fileOpenResult", "fileOpenResult", "fileOpenResult"]);
    expect(opener.open).toHaveBeenCalledTimes(1);
    expect(prompt).not.toHaveBeenCalled();
    expect(abort).not.toHaveBeenCalled();
    expect(runtime.snapshot().messages).toBe(original.messages);
    expect(runtime.snapshot().isStreaming).toBe(true);
  });
});
