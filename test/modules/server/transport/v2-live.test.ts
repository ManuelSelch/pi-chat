import { once } from "node:events";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { afterEach, expect, it, vi } from "vitest";
import { serverMessageSchema } from "@manuelselch/pi-sdk/contract/v2";
import { createPiChatServer, type PiChatServer } from "../../../../src/server/bootstrap/server.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";

let server: PiChatServer;
const sockets: WebSocket[] = [];
afterEach(async () => { for (const socket of sockets.splice(0)) socket.terminate(); if (server) await server.close(); });
function messages(socket: WebSocket) {
  const received: any[] = []; const listeners = new Set<() => void>();
  socket.on("message", data => { received.push(serverMessageSchema.parse(JSON.parse(data.toString()))); for (const listener of [...listeners]) listener(); });
  return { received, async wait(predicate: (message: any) => boolean): Promise<any> {
    const found = received.find(predicate); if (found) return found;
    return new Promise((resolve, reject) => { const timer = setTimeout(() => { listeners.delete(check); reject(new Error(JSON.stringify(received))); }, 2000);
      const check = () => { const message = received.find(predicate); if (message) { clearTimeout(timer); listeners.delete(check); resolve(message); } }; listeners.add(check);
    });
  } };
}
async function connect() {
  const socket = new WebSocket(`ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`); sockets.push(socket);
  const inbox = messages(socket); await once(socket, "open");
  const send = (method: string, requestId: string, params: object = {}, sessionId?: string) => socket.send(JSON.stringify({ version: 2, type: "request", requestId, method, params, ...(sessionId ? { sessionId } : {}) }));
  return { socket, inbox, send, async initialize() {
    send("server.initialize", "init", { client: { name: "test", version: "1" }, capabilities: ["presentation", "command.complete", "file.open"] });
    return (await inbox.wait(message => message.requestId === "init")).result;
  } };
}
it("initializes atomically with fresh runtime identity and rejects v1 on the live socket", async () => {
  server = createPiChatServer(new FakeRuntimeAdapter()); server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  const connection = await connect();
  const state = await connection.initialize();
  expect(state.protocolVersion).toBe(2);
  expect(state.inventory.sessions).toHaveLength(1);
  expect(state.snapshots[0].sessionId).not.toBe("fake-session");
  expect(state.snapshots[0].sessionId).toBe(state.inventory.sessions[0].sessionId);
  expect(state.snapshots[0].runtime.status).toBe("idle");
  connection.socket.send(JSON.stringify({ version: 1, type: "abort", sessionId: "fake-session" }));
  expect(await connection.inbox.wait(message => message.type === "protocolError")).toMatchObject({ error: { code: "unsupportedVersion" } });
});
it("queues admission before synchronous Pi events and publishes operation settlement", async () => {
  server = createPiChatServer(new FakeRuntimeAdapter()); server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  const connection = await connect(); const state = await connection.initialize();
  const sessionId = state.snapshots[0].sessionId;
  connection.send("message.send", "prompt", { message: "hello" }, sessionId);
  const receipt = await connection.inbox.wait(message => message.requestId === "prompt");
  expect(receipt).toMatchObject({ ok: true, result: { state: "accepted" } });
  const settlement = await connection.inbox.wait(message => message.event === "operation.finished");
  expect(settlement).toMatchObject({ sessionId, data: { operationId: receipt.result.operationId, requestId: "prompt", outcome: "completed" } });
  const receiptIndex = connection.inbox.received.indexOf(receipt);
  const deltaIndex = connection.inbox.received.findIndex(message => message.event === "message.delta");
  expect(deltaIndex).toBeGreaterThan(receiptIndex);
  const sequences = connection.inbox.received.filter(message => message.sequence !== undefined).map(message => message.sequence);
  expect(sequences).toEqual(sequences.map((_, index) => index + 1));
});
it("retains closing identity after failed teardown and accepts explicit retry", async () => {
  const runtime = new FakeRuntimeAdapter();
  vi.spyOn(runtime, "dispose").mockImplementationOnce(() => { void runtime.abort(); throw new Error("partial"); });
  server = createPiChatServer(runtime); server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  const connection = await connect(); const state = await connection.initialize(); const sessionId = state.snapshots[0].sessionId;
  connection.send("session.close", "close1", {}, sessionId);
  expect(await connection.inbox.wait(message => message.requestId === "close1")).toMatchObject({ ok: false, error: { details: { partial: true } } });
  expect(connection.inbox.received.filter(message => message.event === "runtime.status").every(message => message.data.status === "closing")).toBe(true);
  connection.send("message.send", "blocked", { message: "no" }, sessionId);
  expect(await connection.inbox.wait(message => message.requestId === "blocked")).toMatchObject({ ok: false, error: { code: "sessionBusy" } });
  connection.send("session.list", "list");
  expect(await connection.inbox.wait(message => message.requestId === "list")).toMatchObject({ result: { sessions: [{ sessionId, status: "closing" }] } });
  connection.send("session.close", "close2", {}, sessionId);
  expect(await connection.inbox.wait(message => message.requestId === "close2")).toMatchObject({ ok: true });
  await connection.inbox.wait(message => message.event === "session.closed");
});
it("never reuses runtime identity when the same saved history is reopened", async () => {
  server = createPiChatServer(new FakeRuntimeAdapter(), undefined, { continueProject: vi.fn(), newSession: vi.fn(), openSession: async () => new FakeRuntimeAdapter() });
  server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  const connection = await connect(); const state = await connection.initialize(); const sessionId = state.snapshots[0].sessionId;
  connection.send("session.close", "close", {}, sessionId);
  expect(await connection.inbox.wait(message => message.requestId === "close")).toMatchObject({ ok: true });
  connection.send("session.open", "open", { sessionPath: "fake-session.jsonl" });
  const opened = await connection.inbox.wait(message => message.requestId === "open");
  expect(opened.ok).toBe(true); expect(opened.result.snapshot.sessionId).not.toBe(sessionId);
  expect(opened.result.snapshot.sessionPath).toBe("fake-session.jsonl");
  connection.send("message.send", "stale", { message: "no" }, sessionId);
  expect(await connection.inbox.wait(message => message.requestId === "stale")).toMatchObject({ ok: false, error: { code: "sessionNotFound" } });
});
it("rejects foreign browser origins before opening a connection", async () => {
  server = createPiChatServer(new FakeRuntimeAdapter()); server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  const socket = new WebSocket(`ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`, { origin: "https://evil.example" });
  const status = await new Promise<number>(resolve => { socket.on("unexpected-response", (_request, response) => { resolve(response.statusCode!); response.resume(); socket.terminate(); }); socket.on("error", () => {}); });
  expect(status).toBe(403);
});
it("does not replace a ready controller until the candidate initializes", async () => {
  server = createPiChatServer(new FakeRuntimeAdapter()); server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  const first = await connect(); await first.initialize();
  const candidate = await connect();
  first.send("server.ping", "ping");
  expect(await first.inbox.wait(message => message.requestId === "ping")).toMatchObject({ ok: true });
  const closed = once(first.socket, "close"); await candidate.initialize();
  expect((await closed)[0]).toBe(4001);
});
