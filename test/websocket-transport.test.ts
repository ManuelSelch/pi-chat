import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { PROTOCOL_VERSION, serverMessageSchema, type ServerMessage } from "../src/shared/protocol.js";
import { createPiChatExtensionRegistry } from "../src/server/extensions/extension-registry.js";
import { FakeRuntimeAdapter } from "./support/fake-runtime-adapter.js";
import { PiSessionStore } from "../src/server/projects/pi-session-store.js";
import { createPiChatServer, type PiChatServer } from "../src/server/bootstrap/server.js";

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

async function connectWithSnapshot(url: string): Promise<{ socket: WebSocket; snapshot: ServerMessage }> {
  const socket = new WebSocket(url);
  const snapshot = receive(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
  return { socket, snapshot: await snapshot };
}

describe("WebSocket transport", () => {
  let server: PiChatServer | undefined;
  let socket: WebSocket | undefined;

  afterEach(async () => {
    socket?.close();
    if (server) await server.close();
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

  it("publishes the closed tab immediately after deleting the current session", async () => {
    const deleteSession = vi.spyOn(PiSessionStore.prototype, "delete").mockResolvedValue(undefined);
    try {
      server = createPiChatServer(new FakeRuntimeAdapter());
      await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
      const connected = await connectWithSnapshot(`ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`);
      socket = connected.socket;
      // Drain the initial publication before listening for the delete response.
      await receiveOfType(socket, "catalogue");
      const tabs = receiveOfType(socket, "tabs");
      const catalogue = receiveOfType(socket, "catalogue");
      socket.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "deleteSession", path: "fake-session.jsonl" }));
      await catalogue;
      expect(deleteSession).toHaveBeenCalledWith("fake-session.jsonl");
      expect(await tabs).toMatchObject({ type: "tabs", tabs: [], activeSessionId: "" });
    } finally {
      deleteSession.mockRestore();
    }
  });

  it("starts on the home screen when no session tab is open", async () => {
    server = createPiChatServer(undefined);
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    const port = (server.httpServer.address() as AddressInfo).port;
    const connected = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws`);
    socket = connected.socket;

    expect(connected.snapshot).toMatchObject({ version: PROTOCOL_VERSION, type: "tabs", tabs: [], activeSessionId: "" });
    expect(await receiveOfType(socket, "catalogue")).toMatchObject({ type: "catalogue" });
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
