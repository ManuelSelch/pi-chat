import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v2Socket } from "../../../infra/v2-socket.js";
import { createPiChatServer, type PiChatServer } from "../../../../src/server/bootstrap/server.js";
import { FileService } from "../../../../src/server/files/file-service.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";

let server: PiChatServer | undefined;
let folder: string | undefined;
afterEach(async () => {
  await server?.close();
  if (folder) await rm(folder, { recursive: true, force: true });
  server = undefined; folder = undefined;
});

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
    const client = await v2Socket(server); const initial = await client.initialize(); client.messages.length = 0;
    const send = async (requestId: string, path: string, sessionId = initial.snapshots[0]!.sessionId) => {
      client.send("file.open", requestId, { path }, sessionId); return client.response(requestId);
    };
    expect(await send("open-1", "harmless.pdf")).toMatchObject({ requestId: "open-1", ok: true });
    expect(opener.open).toHaveBeenCalledWith(await realpath(join(folder, "harmless.pdf")));
    expect(await send("missing-file", "missing.pdf")).toMatchObject({ requestId: "missing-file", ok: false, error: { code: "notFound" } });
    expect(await send("missing-session", "harmless.pdf", "closed-session")).toMatchObject({ requestId: "missing-session", ok: false, error: { code: "sessionNotFound" } });
    // Allow queued writes to arrive before checking the absence of side effects.
    await new Promise((resolve) => setTimeout(resolve, 30));
    // Initialization's independent catalogue refresh may finish after readiness;
    // it is not file.open history/state traffic. Still reject every other event.
    const fileTraffic = client.messages.filter(message => !(message.type === "event" && message.event === "project.list.changed"));
    expect(fileTraffic.map(message => message.type)).toEqual(["response", "response", "response"]);
    expect(opener.open).toHaveBeenCalledTimes(1);
    expect(prompt).not.toHaveBeenCalled();
    expect(abort).not.toHaveBeenCalled();
    expect(runtime.snapshot().messages).toBe(original.messages);
    expect(runtime.snapshot().isStreaming).toBe(true);
  });
});
