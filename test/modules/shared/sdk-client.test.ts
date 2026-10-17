import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";
import { expect, it } from "vitest";
import { PiClient, createWebSocketTransport, type ConnectionPhase } from "@manuelselch/pi-sdk";

function phase(client: PiClient, target: ConnectionPhase): Promise<void> {
  if (client.getState().connection.phase === target) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error(`Did not reach ${target}`)); }, 3000);
    const unsubscribe = client.subscribe((state) => {
      if (state.connection.phase !== target) return;
      clearTimeout(timer); unsubscribe(); resolve();
    });
  });
}

it("uses the public SDK with a real loopback WebSocket without browser globals or Pi", async () => {
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(server, "listening");
  const endpoint = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`;
  const commands: unknown[] = [];
  server.on("connection", (socket) => {
    const send = (message: object) => socket.send(JSON.stringify({ version: 1, ...message }));
    send({ type: "snapshot", sessionId: "s", sequence: 0, throughSequence: 0, projectPath: "/example", messages: [], isStreaming: false });
    send({ type: "tabs", activeSessionId: "s", tabs: [{ sessionId: "s", title: "Example", projectPath: "/example", projectName: "example", status: "idle" }] });
    send({ type: "catalogue", catalogue: { projects: [] } });
    socket.on("message", (data) => {
      const command = JSON.parse(data.toString()); commands.push(command);
      if (command.type === "newSession") send({ type: "sessionOpened", requestId: command.requestId, sessionId: "new-runtime" });
      if (command.type === "openFile") send({ type: "fileOpenResult", requestId: command.requestId, sessionId: command.sessionId, result: { ok: true } });
      if (command.type === "prompt") {
        send({ type: "assistantDelta", sessionId: "s", sequence: 1, runId: "run", delta: "Hello" });
        send({ type: "messageFinal", sessionId: "s", sequence: 2, runId: "run", message: { id: "answer", role: "assistant", text: "Hello" } });
      }
    });
  });
  const client = new PiClient({ endpoint, transport: createWebSocketTransport((url) => new WebSocket(url)), requestTimeoutMs: 2000 });
  try {
    const ready = phase(client, "ready"); client.start(); await ready;
    expect(client.getSession("s")?.projectPath).toBe("/example");
    await expect(client.createSession("/example")).resolves.toBe("new-runtime");
    await expect(client.openFile("s", "/example/file")).resolves.toBeUndefined();
    const final = new Promise<void>((resolve) => {
      const unsubscribe = client.onMessage((message) => { if (message.type === "messageFinal") { unsubscribe(); resolve(); } });
    });
    client.prompt("s", "hello"); await final;
    expect(client.getSession("s")?.messages).toEqual([{ id: "answer", role: "assistant", text: "Hello" }]);
    expect(client.getSession("s")?.draft).toBeUndefined();
    expect(commands).toHaveLength(3);
    const superseded = phase(client, "superseded");
    for (const socket of server.clients) socket.close(4001, "Controller replaced");
    await superseded;
  } finally {
    client.dispose();
    for (const socket of server.clients) socket.terminate();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
