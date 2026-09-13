import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { PROTOCOL_VERSION, serverMessageSchema, type ServerMessage } from "../src/shared/protocol.js";
import { PiRuntimeAdapter } from "../src/server/pi-runtime-adapter.js";
import { createPiChatServer } from "../src/server/server.js";

const cwd = mkdtempSync(join(tmpdir(), "pi-chat-verify-"));
const runtime = await PiRuntimeAdapter.create(cwd);
const server = createPiChatServer(runtime);
await new Promise<void>((resolve) => server.httpServer.listen(0, "127.0.0.1", resolve));
const url = `ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`;

function open(): Promise<{ socket: WebSocket; events: ServerMessage[] }> {
  const socket = new WebSocket(url);
  const events: ServerMessage[] = [];
  socket.on("message", (data) => events.push(serverMessageSchema.parse(JSON.parse(data.toString()))));
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve({ socket, events }));
    socket.once("error", reject);
  });
}

const first = await open();
first.socket.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "prompt", message: "Reply with exactly: pi-chat slice 1 works" }));
await new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timed out waiting for the run to settle")), 120_000);
  first.socket.on("message", (data) => {
    const event = serverMessageSchema.parse(JSON.parse(data.toString()));
    if (event.type === "runtimeStatus" && event.status === "idle") {
      clearTimeout(timer);
      resolve();
    }
  });
});

const deltas = first.events.filter((event) => event.type === "assistantDelta");
const finals = first.events.filter((event) => event.type === "messageFinal");
console.log("deltas:", deltas.length);
console.log("final messages:", finals.length);
console.log("assembled:", deltas.map((event) => (event.type === "assistantDelta" ? event.delta : "")).join(""));

first.socket.close();
await new Promise((resolve) => first.socket.once("close", resolve));

const reloaded = await open();
await new Promise((resolve) => setTimeout(resolve, 300));
const snapshot = reloaded.events.find((event) => event.type === "snapshot");
if (snapshot?.type === "snapshot") {
  console.log("reload session:", snapshot.sessionId);
  console.log("reload messages:", snapshot.messages.map((message) => `${message.role}:${message.text.slice(0, 60)}`));
  const assistant = snapshot.messages.filter((message) => message.role === "assistant");
  console.log("assistant copies after reload:", assistant.length);
  console.log("duplicate ids:", snapshot.messages.length !== new Set(snapshot.messages.map((m) => m.id)).size);
}
reloaded.socket.close();
await server.close();
process.exit(0);
