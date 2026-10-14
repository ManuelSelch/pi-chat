import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { PROTOCOL_VERSION, serverMessageSchema, type ServerMessage } from "../../../../src/shared/protocol.js";
import { createPiChatExtensionRegistry } from "../../../../src/server/extensions/extension-registry.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";
import { ProjectSessionService } from "../../../../src/server/projects/project-session-service.js";
import { createPiChatServer, type PiChatServer } from "../../../../src/server/bootstrap/server.js";

/** Waits for one specific message type; connect also pushes snapshots and tabs. */
function receiveOfType(socket: WebSocket, type: ServerMessage["type"]): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: Buffer) => {
      const parsed = serverMessageSchema.safeParse(JSON.parse(data.toString()));
      if (!parsed.success) {
        socket.off("message", onMessage);
        reject(parsed.error);
        return;
      }
      if (parsed.data.type !== type) return;
      socket.off("message", onMessage);
      resolve(parsed.data);
    };
    socket.on("message", onMessage);
  });
}

function receive(socket: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    socket.once("message", (data) => {
      const parsed = serverMessageSchema.safeParse(JSON.parse(data.toString()));
      if (parsed.success) resolve(parsed.data);
      else reject(parsed.error);
    });
  });
}

async function connectWithSnapshot(url: string): Promise<{ socket: WebSocket; snapshot: ServerMessage; catalogue: Promise<ServerMessage> }> {
  const socket = new WebSocket(url);
  // Subscribe before connection: a fast empty catalogue may arrive with the snapshot.
  const catalogue = receiveOfType(socket, "catalogue");
  const snapshot = receive(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
  return { socket, snapshot: await snapshot, catalogue };
}

describe("WebSocket transport", () => {
  let server: PiChatServer | undefined;
  let socket: WebSocket | undefined;

  afterEach(async () => {
    socket?.close();
    if (server) await server.close();
  });

  it("logs connection lifecycle metadata without logging WebSocket payloads", async () => {
    const logger = {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(),
      flush: vi.fn(async () => {}), close: vi.fn(async () => {}),
    };
    server = createPiChatServer(new FakeRuntimeAdapter(), undefined, undefined, undefined, undefined, undefined, logger);
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    const connected = await connectWithSnapshot(`ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`);
    socket = connected.socket;
    const close = new Promise<void>((resolve) => socket!.once("close", () => resolve()));
    socket.close(1000, "test close");
    await close;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(logger.info).toHaveBeenCalledWith("websocket.open", { connectionId: expect.any(String) });
    expect(logger.info).toHaveBeenCalledWith("websocket.close", expect.objectContaining({
      connectionId: expect.any(String), code: 1000, reason: "test close", controller: true,
      runtimeActive: false,
    }));
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("test payload");
  });

  it("returns Pi argument suggestions without running or publishing a snapshot", async () => {
    const runtime = new FakeRuntimeAdapter();
    const complete = vi.spyOn(runtime, "completeCommandArguments").mockResolvedValue([{ value: "staging", label: "Staging" }]);
    const prompt = vi.spyOn(runtime, "prompt");
    server = createPiChatServer(runtime);
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    const connected = await connectWithSnapshot(`ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`);
    socket = connected.socket;
    const reply = receiveOfType(socket, "commandArgumentCompletions");
    socket.send(JSON.stringify({ version: 1, type: "completeCommandArguments", sessionId: "fake-session", requestId: "c1", commandName: "deploy:2", argumentPrefix: "st" }));
    expect(await reply).toMatchObject({ requestId: "c1", sessionId: "fake-session", items: [{ value: "staging", label: "Staging" }] });
    expect(complete).toHaveBeenCalledWith("deploy:2", "st");
    expect(prompt).not.toHaveBeenCalled();
    const failure = receiveOfType(socket, "commandArgumentCompletions");
    complete.mockRejectedValueOnce(new Error("Provider unavailable"));
    socket.send(JSON.stringify({ version: 1, type: "completeCommandArguments", sessionId: "fake-session", requestId: "c2", commandName: "deploy", argumentPrefix: "" }));
    expect(await failure).toMatchObject({ requestId: "c2", items: [], error: "Provider unavailable" });
  });

  it("publishes the closed tab and acknowledges archiving the current session", async () => {
    const archiveSession = vi.spyOn(ProjectSessionService.prototype, "archive").mockResolvedValue(undefined);
    const catalogueScan = vi.spyOn(ProjectSessionService.prototype, "catalogue");
    try {
      server = createPiChatServer(new FakeRuntimeAdapter());
      await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
      const connected = await connectWithSnapshot(`ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`);
      socket = connected.socket;
      // Drain the initial publication before listening for the archive response.
      await connected.catalogue;
      catalogueScan.mockClear();
      const tabs = receiveOfType(socket, "tabs");
      const catalogue = receiveOfType(socket, "catalogue");
      const reply = receiveOfType(socket, "projectMutationResult");
      socket.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "setSessionArchived", path: "fake-session.jsonl", archived: true, requestId: "archive-1" }));
      await catalogue;
      expect(await reply).toMatchObject({ type: "projectMutationResult", requestId: "archive-1" });
      expect(archiveSession).toHaveBeenCalledWith("fake-session.jsonl", true);
      expect(catalogueScan).toHaveBeenCalledExactlyOnceWith(undefined, { metadataOnly: true });
      expect(await tabs).toMatchObject({ type: "tabs", tabs: [], activeSessionId: "" });
    } finally {
      archiveSession.mockRestore();
      catalogueScan.mockRestore();
    }
  });

  it.each([true, false])("refreshes pin metadata before acknowledging pinned=%s", async pinned => {
    const pinProject = vi.spyOn(ProjectSessionService.prototype, "pin").mockResolvedValue(undefined);
    const catalogueScan = vi.spyOn(ProjectSessionService.prototype, "catalogue");
    try {
      server = createPiChatServer(new FakeRuntimeAdapter());
      await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
      const connected = await connectWithSnapshot(`ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`);
      socket = connected.socket;
      await connected.catalogue;
      catalogueScan.mockClear();
      const catalogue = receiveOfType(socket, "catalogue");
      const reply = receiveOfType(socket, "projectMutationResult");
      socket.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "pinProject", path: process.cwd(), pinned, requestId: "pin-1" }));
      await catalogue;
      expect(await reply).toMatchObject({ type: "projectMutationResult", requestId: "pin-1" });
      expect(pinProject).toHaveBeenCalledWith(process.cwd(), pinned);
      expect(catalogueScan).toHaveBeenCalledExactlyOnceWith(expect.any(Object), { metadataOnly: true });
    } finally {
      pinProject.mockRestore();
      catalogueScan.mockRestore();
    }
  });

  it.each(["newSession", "openSession"] as const)("publishes %s before its single catalogue scan completes", async type => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const catalogue = vi.spyOn(ProjectSessionService.prototype, "catalogue")
      .mockResolvedValueOnce({ projects: [] })
      .mockImplementation(async () => { await gate; return { projects: [] }; });
    const remember = vi.spyOn(ProjectSessionService.prototype, "rememberProject").mockResolvedValue(undefined);
    try {
      const next = new FakeRuntimeAdapter("next-session");
      server = createPiChatServer(new FakeRuntimeAdapter(), undefined, {
        continueProject: async () => next, openSession: async () => next, newSession: async () => next,
      });
      await new Promise<void>(resolve => server!.httpServer.listen(0, "127.0.0.1", resolve));
      const connected = await connectWithSnapshot(`ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`);
      socket = connected.socket;
      await connected.catalogue;
      expect(catalogue).toHaveBeenCalledOnce();
      const snapshot = receiveOfType(socket, "snapshot");
      const tabs = receiveOfType(socket, "tabs");
      const opened = type === "newSession" ? receiveOfType(socket, "sessionOpened") : undefined;
      const refreshed = receiveOfType(socket, "catalogue");
      socket.send(JSON.stringify(type === "newSession"
        ? { version: 1, type, requestId: "open-fast" }
        : { version: 1, type, path: "next-session.jsonl" }));
      expect(await snapshot).toMatchObject({ sessionId: "next-session" });
      expect(await tabs).toMatchObject({ activeSessionId: "next-session" });
      if (opened) expect(await opened).toMatchObject({ sessionId: "next-session", requestId: "open-fast" });
      await vi.waitFor(() => expect(catalogue).toHaveBeenCalledTimes(2));
      release();
      await refreshed;
      expect(catalogue).toHaveBeenCalledTimes(2);
    } finally { release(); catalogue.mockRestore(); remember.mockRestore(); }
  });

  it("starts on the home screen when no session tab is open", async () => {
    server = createPiChatServer(undefined);
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    const port = (server.httpServer.address() as AddressInfo).port;
    const connected = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws`);
    socket = connected.socket;

    expect(connected.snapshot).toMatchObject({ version: PROTOCOL_VERSION, type: "tabs", tabs: [], activeSessionId: "" });
    expect(await connected.catalogue).toMatchObject({ type: "catalogue" });
  });

  it("sends a versioned snapshot and survives malformed input", async () => {
    server = createPiChatServer(new FakeRuntimeAdapter());
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    const port = (server.httpServer.address() as AddressInfo).port;
    const connected = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws`);
    socket = connected.socket;

    const snapshot = connected.snapshot;
    expect(snapshot).toMatchObject({ version: PROTOCOL_VERSION, type: "snapshot", sessionId: "fake-session", throughSequence: 0 });

    socket.send("not json");
    expect(await receiveOfType(socket, "protocolError")).toMatchObject({ error: "Message must be valid JSON." });
    expect(socket.readyState).toBe(WebSocket.OPEN);
  });

  it("replaces an existing controller by default", async () => {
    server = createPiChatServer(new FakeRuntimeAdapter());
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    const port = (server.httpServer.address() as AddressInfo).port;
    const first = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws`);
    socket = first.socket;

    const closed = new Promise<{ code: number; reason: string }>((resolve) => {
      first.socket.once("close", (code, reason) => resolve({ code, reason: reason.toString() }));
    });
    const second = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws`);
    socket = second.socket;

    await expect(closed).resolves.toMatchObject({ code: 4001, reason: "Controller replaced" });
    expect(second.socket.readyState).toBe(WebSocket.OPEN);
  });

  it("streams two deltas, finalizes once, and restores one transcript after reload", async () => {
    server = createPiChatServer(new FakeRuntimeAdapter());
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    const port = (server.httpServer.address() as AddressInfo).port;
    const url = `ws://127.0.0.1:${port}/ws`;
    const initial = await connectWithSnapshot(url);
    socket = initial.socket;

    const events: ServerMessage[] = [];
    const completed = new Promise<void>((resolve) => {
      socket!.on("message", (data) => {
        const event = serverMessageSchema.parse(JSON.parse(data.toString()));
        events.push(event);
        if (event.type === "runtimeStatus" && event.status === "idle") resolve();
      });
    });
    socket.send(JSON.stringify({ version: PROTOCOL_VERSION, sessionId: "fake-session", type: "prompt", message: "Hello" }));
    await completed;

    expect(events.filter((event) => event.type === "assistantDelta")).toHaveLength(2);
    expect(events.filter((event) => event.type === "messageFinal")).toHaveLength(1);

    socket.close();
    await new Promise<void>((resolve) => socket!.once("close", () => resolve()));
    const reloaded = await connectWithSnapshot(url);
    socket = reloaded.socket;
    const snapshot = reloaded.snapshot;
    expect(snapshot.type).toBe("snapshot");
    if (snapshot.type === "snapshot") {
      expect(snapshot.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
      expect(snapshot.messages.filter((message) => message.role === "assistant" && message.text === "Hello from Pi Chat.")).toHaveLength(1);
    }
  });
});
