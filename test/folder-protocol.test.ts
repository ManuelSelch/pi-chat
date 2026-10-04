import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm, symlink, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { serverMessageSchema, parseClientMessage, type ServerMessage } from "../src/shared/protocol.js";
import { createPiChatServer, type PiChatServer } from "../src/server/bootstrap/server.js";
import { FakeRuntimeAdapter } from "../src/server/runtime/runtime-adapter.js";
import { ChatApplicationService } from "../src/server/application/chat-application-service.js";

let server: PiChatServer | undefined;
let socket: WebSocket | undefined;
let folder: string | undefined;
afterEach(async () => {
  socket?.close();
  await server?.close();
  server = undefined;
  socket = undefined;
  if (folder) await rm(folder, { recursive: true, force: true });
  folder = undefined;
});
function receive(type: string): Promise<ServerMessage> {
  return new Promise((resolve) => {
    const listener = (data: WebSocket.RawData) => {
      const message = serverMessageSchema.parse(JSON.parse(data.toString()));
      if (message.type === type) { socket!.off("message", listener); resolve(message); }
    };
    socket!.on("message", listener);
  });
}
async function connect(factory = { continueProject: vi.fn(), openSession: vi.fn(), newSession: vi.fn(async () => new FakeRuntimeAdapter()) }) {
  server = createPiChatServer(undefined, undefined, factory);
  await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
  socket = new WebSocket(`ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`);
  const tabs = receive("tabs");
  await tabs;
  return factory;
}
function send(message: object) { socket!.send(JSON.stringify({ version: 1, ...message })); }

describe("folder requests", () => {
  it("browses without open tabs and correlates replies without creating a runtime", async () => {
    folder = await mkdtemp(join(tmpdir(), "pi-browser-"));
    await mkdir(join(folder, "new-project"));
    const factory = await connect();
    const reply = receive("directoryListing");
    send({ type: "browseDirectories", requestId: "browse-1", path: folder });
    expect(await reply).toMatchObject({ type: "directoryListing", requestId: "browse-1", listing: { path: await realpath(folder), entries: [{ name: "new-project" }] } });
    expect(factory.newSession).not.toHaveBeenCalled();
    expect(factory.continueProject).not.toHaveBeenCalled();
  });
  it("reports browse and start failures at app level on Home", async () => {
    await connect();
    const browse = receive("directoryBrowseError");
    send({ type: "browseDirectories", requestId: "bad-browse", path: "/missing/pi-chat-folder" });
    expect(await browse).toMatchObject({ requestId: "bad-browse", error: expect.stringContaining("not found") });
    const start = receive("sessionOpenError");
    send({ type: "newSession", requestId: "bad-start", path: "/missing/pi-chat-folder" });
    expect(await start).toMatchObject({ requestId: "bad-start", error: expect.stringContaining("not found") });
  });
  it("starts a fresh session with the canonical folder and returns its correlated outcome", async () => {
    folder = await mkdtemp(join(tmpdir(), "pi-browser-"));
    await mkdir(join(folder, "target"));
    await symlink(join(folder, "target"), join(folder, "link"));
    const factory = await connect();
    const reply = receive("sessionOpened");
    send({ type: "newSession", requestId: "start-1", path: join(folder, "link") });
    expect(await reply).toMatchObject({ type: "sessionOpened", requestId: "start-1", sessionId: "fake-session" });
    expect(factory.newSession).toHaveBeenCalledWith(await realpath(join(folder, "target")));
    expect(factory.continueProject).not.toHaveBeenCalled();
  });
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
    const reply = receive("sessionOpenError");
    send({ type: "newSession", requestId: "runtime-failure", path: folder });
    expect(await reply).toMatchObject({ type: "sessionOpenError", requestId: "runtime-failure", error: "Runtime unavailable" });
  });
  it("validates explicit open-project paths too", async () => {
    const factory = { continueProject: vi.fn(), newSession: vi.fn(), openSession: vi.fn() };
    const chat = new ChatApplicationService(undefined, factory);
    await expect(chat.openProject("/missing/pi-chat-folder")).rejects.toThrow("not found");
    expect(factory.continueProject).not.toHaveBeenCalled();
  });
  it("rejects malformed paths and cursors", () => {
    expect(() => parseClientMessage({ version: 1, type: "browseDirectories", requestId: "x", path: "\0" })).toThrow();
    expect(() => parseClientMessage({ version: 1, type: "browseDirectories", requestId: "x", path: "/", cursor: 3 })).toThrow();
  });
});
