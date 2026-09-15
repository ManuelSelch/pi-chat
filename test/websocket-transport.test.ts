import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { PROTOCOL_VERSION, serverMessageSchema, type ServerMessage } from "../src/shared/protocol.js";
import { createPiChatExtensionRegistry } from "../src/server/extension-registry.js";
import { FakeRuntimeAdapter } from "../src/server/runtime-adapter.js";
import { createPiChatServer, type PiChatServer } from "../src/server/server.js";

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

  it("keeps multiple sockets connected when extensions opt into multi-connection mode", async () => {
    const extensions = createPiChatExtensionRegistry();
    extensions.setConnectionMode("multi-connection");
    server = createPiChatServer(new FakeRuntimeAdapter(), undefined, undefined, undefined, extensions);
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    const port = (server.httpServer.address() as AddressInfo).port;

    const first = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws`);
    socket = first.socket;
    const second = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws`);

    expect(first.socket.readyState).toBe(WebSocket.OPEN);
    expect(second.socket.readyState).toBe(WebSocket.OPEN);
    second.socket.close();
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
      expect(snapshot.messages.filter((message) => message.role !== "tool" && message.text === "Hello from Pi Chat.")).toHaveLength(1);
    }
  });
});
