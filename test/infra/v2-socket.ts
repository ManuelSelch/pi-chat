import { once } from "node:events";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { capabilitySchema, serverMessageSchema, type ServerMessage, type Result } from "@manuelselch/pi-sdk/contract";
import type { PiChatServer } from "../../src/server/bootstrap/server.js";

/** Keep every frame so tests never race response/event listener registration. */
export async function v2Socket(server: PiChatServer) {
  const socket = new WebSocket(`ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`);
  const messages: ServerMessage[] = []; const listeners = new Set<() => void>();
  socket.on("message", data => { messages.push(serverMessageSchema.parse(JSON.parse(data.toString()))); for (const listener of [...listeners]) listener(); });
  await once(socket, "open");
  const wait = async (predicate: (message: ServerMessage) => boolean): Promise<ServerMessage> => {
    const found = messages.find(predicate); if (found) return found;
    return new Promise((resolve, reject) => {
      const check = () => { const found = messages.find(predicate); if (found) { clearTimeout(timer); listeners.delete(check); resolve(found); } };
      const timer = setTimeout(() => { listeners.delete(check); reject(new Error(`Timed out; frames: ${JSON.stringify(messages)}`)); }, 2000); listeners.add(check);
    });
  };
  const send = (method: string, requestId: string, params: object = {}, sessionId?: string) => socket.send(JSON.stringify({ version: 2, type: "request", method, requestId, params, ...(sessionId ? { sessionId } : {}) }));
  const response = async (id: string) => {
    const message = await wait(message => message.type === "response" && message.requestId === id);
    if (message.type !== "response") throw new Error("Expected response"); return message;
  };
  return { socket, messages, wait, send, response, async initialize(capabilities: string[] = capabilitySchema.options): Promise<Result<"server.initialize">> {
    send("server.initialize", "init", { client: { name: "test", version: "1" }, capabilities });
    const reply = await response("init"); if (!reply.ok) throw new Error(reply.error.message);
    // Method-specific parsing also validates the full atomic readiness barrier.
    return (await import("@manuelselch/pi-sdk/contract")).initializeResultSchema.parse(reply.result);
  } };
}
