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

  it("broadcasts runtime events to all sockets in multi-connection mode", async () => {
    const extensions = createPiChatExtensionRegistry();
    extensions.setConnectionMode("multi-connection");
    server = createPiChatServer(new FakeRuntimeAdapter(), undefined, undefined, undefined, extensions);
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    const port = (server.httpServer.address() as AddressInfo).port;
    const first = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws`);
    socket = first.socket;
    const second = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws`);

    const firstFinal = receiveOfType(first.socket, "messageFinal");
    const secondFinal = receiveOfType(second.socket, "messageFinal");
    first.socket.send(JSON.stringify({ version: PROTOCOL_VERSION, sessionId: "fake-session", type: "prompt", message: "Hello" }));

    await expect(firstFinal).resolves.toMatchObject({ type: "messageFinal" });
    await expect(secondFinal).resolves.toMatchObject({ type: "messageFinal" });
    second.socket.close();
  });

  it("lets a policy extension refuse prompts from an invited guest", async () => {
    const extensions = createPiChatExtensionRegistry();
    extensions.setConnectionMode("multi-connection");
    const guests = new Set<string>();
    extensions.use("connection.authorize", ({ connectionId, request }) => {
      if (request?.query.invite) guests.add(connectionId);
    });
    extensions.use("prompt.authorize", ({ connectionId }) =>
      guests.has(connectionId) ? { allow: false, reason: "Read-only guest." } : { allow: true },
    );
    server = createPiChatServer(new FakeRuntimeAdapter(), undefined, undefined, undefined, extensions);
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    const port = (server.httpServer.address() as AddressInfo).port;

    const owner = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws`);
    const guest = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws?invite=demo`);
    socket = guest.socket;
    const refused = receiveOfType(guest.socket, "protocolError");
    guest.socket.send(JSON.stringify({ version: PROTOCOL_VERSION, sessionId: "fake-session", type: "prompt", message: "Hello" }));

    expect(await refused).toMatchObject({ type: "protocolError", error: "Read-only guest." });
    // The refusal belongs to the guest alone; the owner's screen must stay clean.
    const ownerSaw: string[] = [];
    owner.socket.on("message", (data: Buffer) => ownerSaw.push(String(JSON.parse(data.toString()).type)));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(ownerSaw).not.toContain("protocolError");
    owner.socket.close();
  });

  it("lets a policy extension refuse session commands and dialog answers", async () => {
    const extensions = createPiChatExtensionRegistry();
    extensions.setConnectionMode("multi-connection");
    const guests = new Set<string>();
    const operations: string[] = [];
    extensions.use("connection.authorize", ({ connectionId, request }) => {
      if (request?.query.invite) guests.add(connectionId);
    });
    extensions.use("session.authorize", ({ connectionId, operation }) => {
      operations.push(operation ?? "");
      return guests.has(connectionId) ? { allow: false, reason: "Read-only guest." } : { allow: true };
    });
    extensions.use("dialog.authorize", ({ connectionId }) =>
      guests.has(connectionId) ? { allow: false, reason: "Guests cannot answer dialogs." } : { allow: true },
    );
    server = createPiChatServer(new FakeRuntimeAdapter(), undefined, undefined, undefined, extensions);
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    const port = (server.httpServer.address() as AddressInfo).port;

    const guest = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws?invite=demo`);
    socket = guest.socket;

    const refusedClose = receiveOfType(guest.socket, "protocolError");
    guest.socket.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "closeTab", sessionId: "fake-session" }));
    expect(await refusedClose).toMatchObject({ error: "Read-only guest." });
    expect(operations).toContain("closeTab");
    // The destructive command must not have run behind the refusal.
    const tabs = receiveOfType(guest.socket, "tabs");
    guest.socket.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "focusTab", sessionId: "fake-session" }));
    expect((await tabs as { tabs: unknown[] }).tabs).toHaveLength(1);

    const refusedDialog = receiveOfType(guest.socket, "protocolError");
    guest.socket.send(JSON.stringify({
      version: PROTOCOL_VERSION, sessionId: "fake-session", type: "uiPromptResponse",
      promptId: "p1", result: { cancelled: false, value: "yes" },
    }));
    expect(await refusedDialog).toMatchObject({ error: "Guests cannot answer dialogs." });
  });

  it("gives every connection its own focused tab while sharing the open sessions", async () => {
    const extensions = createPiChatExtensionRegistry();
    extensions.setConnectionMode("multi-connection");
    const factory = {
      continueProject: async () => new FakeRuntimeAdapter("second"),
      openSession: async () => new FakeRuntimeAdapter("second"),
      newSession: async () => new FakeRuntimeAdapter("second"),
    };
    server = createPiChatServer(new FakeRuntimeAdapter(), undefined, factory, undefined, extensions);
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    const port = (server.httpServer.address() as AddressInfo).port;

    const first = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws`);
    socket = first.socket;
    const second = await connectWithSnapshot(`ws://127.0.0.1:${port}/ws`);

    const firstTabs = receiveOfType(first.socket, "tabs");
    const secondTabs = receiveOfType(second.socket, "tabs");
    first.socket.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "newSession" }));

    // Both browsers learn about the new tab, but only the one that opened it
    // follows it; the other keeps looking at what it was reading.
    expect(await firstTabs).toMatchObject({ activeSessionId: "second" });
    expect(await secondTabs).toMatchObject({ activeSessionId: "fake-session" });
    expect((await firstTabs as { tabs: unknown[] }).tabs).toHaveLength(2);
    expect((await secondTabs as { tabs: unknown[] }).tabs).toHaveLength(2);

    // Focusing is a private view change: it must not move the other browser.
    const refocused = receiveOfType(second.socket, "tabs");
    second.socket.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "focusTab", sessionId: "second" }));
    expect(await refocused).toMatchObject({ activeSessionId: "second" });
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
