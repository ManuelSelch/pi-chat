import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm, symlink, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requestSchema } from "@manuelselch/pi-sdk/contract/v2";
import { v2Socket } from "../../../infra/v2-socket.js";
import { createPiChatServer, type PiChatServer } from "../../../../src/server/bootstrap/server.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";
import { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";

let server: PiChatServer | undefined;
let client: Awaited<ReturnType<typeof v2Socket>>;
let folder: string | undefined;
afterEach(async () => {
  client?.socket.terminate();
  await server?.close();
  server = undefined;
  if (folder) await rm(folder, { recursive: true, force: true });
  folder = undefined;
});
async function connect(factory = { continueProject: vi.fn(), openSession: vi.fn(), newSession: vi.fn(async () => new FakeRuntimeAdapter()) }) {
  server = createPiChatServer(undefined, undefined, factory);
  await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
  client = await v2Socket(server); await client.initialize();
  return factory;
}

describe("folder requests", () => {
  it("browses without open tabs and correlates replies without creating a runtime", async () => {
    folder = await mkdtemp(join(tmpdir(), "pi-browser-"));
    await mkdir(join(folder, "new-project"));
    const factory = await connect();
    client.send("directory.browse", "browse-1", { path: folder });
    expect(await client.response("browse-1")).toMatchObject({ ok: true, result: { path: await realpath(folder), entries: [{ name: "new-project" }] } });
    expect(factory.newSession).not.toHaveBeenCalled();
    expect(factory.continueProject).not.toHaveBeenCalled();
  });
  it("reports browse and start failures at app level on Home", async () => {
    await connect();
    client.send("directory.browse", "bad-browse", { path: "/missing/pi-chat-folder" });
    expect(await client.response("bad-browse")).toMatchObject({ ok: false, error: { code: "operationFailed" } });
    client.send("session.create", "bad-start", { projectPath: "/missing/pi-chat-folder" });
    expect(await client.response("bad-start")).toMatchObject({ ok: false, error: { code: "operationFailed" } });
  });
  it("starts a fresh session with the canonical folder and returns its correlated outcome", async () => {
    folder = await mkdtemp(join(tmpdir(), "pi-browser-"));
    await mkdir(join(folder, "target"));
    await symlink(join(folder, "target"), join(folder, "link"));
    const factory = await connect();
    client.send("session.create", "start-1", { projectPath: join(folder, "link") });
    expect(await client.response("start-1")).toMatchObject({ ok: true, result: { snapshot: { sessionId: expect.not.stringMatching(/^fake-session$/) } } });
    expect(factory.newSession).toHaveBeenCalledWith(await realpath(join(folder, "target")));
    expect(factory.continueProject).not.toHaveBeenCalled();
  }, 15000);
  it("leaves an existing streaming tab untouched when opening a new folder", async () => {
    folder = await mkdtemp(join(tmpdir(), "pi-browser-"));
    const current = new FakeRuntimeAdapter("running");
    const previous = current.snapshot();
    vi.spyOn(current, "snapshot").mockReturnValue({ ...previous, isStreaming: true });
    const next = new FakeRuntimeAdapter("fresh");
    const factory = { continueProject: vi.fn(), newSession: vi.fn(async () => next), openSession: vi.fn() };
    const chat = new ChatApplicationService(current, factory);
    await chat.newSession(folder);
    expect(chat.tabs().map((tab) => tab.sessionId)).toEqual(["running", "fresh"]);
    expect(chat.activeSessionId()).toBe("fresh");
    expect(current.snapshot()).toEqual({ ...previous, isStreaming: true });
    await chat.dispose();
  });
  it("keeps Home open if the runtime factory fails after valid directory selection", async () => {
    folder = await mkdtemp(join(tmpdir(), "pi-browser-"));
    await connect({ continueProject: vi.fn(), openSession: vi.fn(), newSession: vi.fn(async () => { throw new Error("Runtime unavailable"); }) });
    client.send("session.create", "runtime-failure", { projectPath: folder });
    expect(await client.response("runtime-failure")).toMatchObject({ ok: false, error: { code: "operationFailed" } });
    client.send("session.list", "list");
    expect(await client.response("list")).toMatchObject({ result: { sessions: [] } });
  });
  it("validates explicit open-project paths too", async () => {
    const factory = { continueProject: vi.fn(), newSession: vi.fn(), openSession: vi.fn() };
    const chat = new ChatApplicationService(undefined, factory);
    await expect(chat.openProject("/missing/pi-chat-folder")).rejects.toThrow("not found");
    expect(factory.continueProject).not.toHaveBeenCalled();
  });
  it("rejects malformed paths and cursors", () => {
    expect(() => requestSchema.parse({ version: 2, type: "request", method: "directory.browse", requestId: "x", params: { path: "\0" } })).toThrow();
    expect(() => requestSchema.parse({ version: 2, type: "request", method: "directory.browse", requestId: "x", params: { path: "/", cursor: 3 } })).toThrow();
  });
});
