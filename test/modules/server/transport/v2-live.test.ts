import { once } from "node:events";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { afterEach, expect, it, vi } from "vitest";
import { serverMessageSchema } from "@manuelselch/pi-sdk/contract";
import { createPiChatServer, type PiChatServer } from "../../../../src/server/bootstrap/server.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";
import { normalizePiId, toolMessageId } from "../../../../src/server/runtime/pi/tool-mapping.js";

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
async function connect(capabilities = ["presentation", "command.complete", "file.open"]) {
  const socket = new WebSocket(`ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`); sockets.push(socket);
  const inbox = messages(socket); await once(socket, "open");
  const send = (method: string, requestId: string, params: object = {}, sessionId?: string) => socket.send(JSON.stringify({ version: 2, type: "request", requestId, method, params, ...(sessionId ? { sessionId } : {}) }));
  return { socket, inbox, send, async initialize() {
    send("server.initialize", "init", { client: { name: "test", version: "1" }, capabilities });
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
it("initializes and streams Pi tool IDs longer than control-plane IDs", async () => {
  const runtime = new FakeRuntimeAdapter(); const base = runtime.snapshot(); const toolCallId = `pi-tool-${"x".repeat(512)}`;
  vi.spyOn(runtime, "snapshot").mockReturnValue({ ...base, messages: [{ id: toolMessageId(toolCallId), role: "tool", tool: { toolCallId: normalizePiId(toolCallId, 123), name: "read", status: "success", outputText: "ok" } }] });
  server = createPiChatServer(runtime); server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  const connection = await connect(); const state = await connection.initialize();
  expect(state.snapshots[0].messages[0]).toMatchObject({ id: toolMessageId(toolCallId), tool: { toolCallId: normalizePiId(toolCallId, 123) } });
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
it("answers session-level prompts once, rejects invalid/late replies, and cancels on close", async () => {
  const runtime = new FakeRuntimeAdapter();
  server = createPiChatServer(runtime); server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  const connection = await connect(); const state = await connection.initialize(); const sessionId = state.snapshots[0].sessionId;
  const pending = runtime.uiContext().confirm("Allow action?", "Run it?");
  const opened = await connection.inbox.wait(message => message.event === "prompt.list.changed" && message.data.prompts.length === 1);
  const promptId = opened.data.prompts[0].id;
  connection.send("prompt.answer", "bad-answer", { promptId, result: { cancelled: false, value: "yes" } }, sessionId);
  expect(await connection.inbox.wait(message => message.requestId === "bad-answer")).toMatchObject({ ok: false, error: { code: "invalidPromptAnswer" } });
  expect(runtime.snapshot().prompts).toHaveLength(1);
  connection.send("prompt.answer", "answer", { promptId, result: { cancelled: false, value: true } }, sessionId);
  expect(await connection.inbox.wait(message => message.requestId === "answer")).toMatchObject({ ok: true });
  await expect(pending).resolves.toBe(true);
  connection.send("prompt.answer", "late-answer", { promptId, result: { cancelled: true } }, sessionId);
  expect(await connection.inbox.wait(message => message.requestId === "late-answer")).toMatchObject({ ok: false, error: { code: "invalidPromptAnswer" } });
  const afterClose = runtime.uiContext().confirm("Close me?", "Closing cancels this dialog.");
  await connection.inbox.wait(message => message.event === "prompt.list.changed" && message.data.prompts.length === 1);
  connection.send("session.close", "close-with-prompt", {}, sessionId);
  expect(await connection.inbox.wait(message => message.requestId === "close-with-prompt")).toMatchObject({ ok: true });
  await expect(afterClose).resolves.toBe(false);
});
it("acknowledges restart admission before the best-effort stopping event", async () => {
  const restart = vi.fn(async () => undefined);
  server = createPiChatServer(undefined, undefined, { continueProject: vi.fn(), newSession: vi.fn(), openSession: vi.fn() }, { restart });
  server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  const connection = await connect(["server.restart"]); await connection.initialize();
  connection.send("server.restart", "restart", {});
  const receipt = await connection.inbox.wait(message => message.requestId === "restart");
  const stopping = await connection.inbox.wait(message => message.event === "server.stopping");
  expect(receipt).toMatchObject({ ok: true, result: { state: "accepted" } });
  expect(connection.inbox.received.indexOf(receipt)).toBeLessThan(connection.inbox.received.indexOf(stopping));
  expect(restart).toHaveBeenCalledOnce();
  expect(connection.inbox.received.some(message => message.event === "operation.finished")).toBe(false);
});
it("keeps runtime identity across explicit in-place reload", async () => {
  const runtime = new FakeRuntimeAdapter(); const reload = vi.spyOn(runtime, "reload");
  server = createPiChatServer(runtime); server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  const connection = await connect(); const initial = await connection.initialize(); const sessionId = initial.snapshots[0].sessionId;
  connection.send("session.reload", "reload", {}, sessionId);
  const receipt = await connection.inbox.wait(message => message.requestId === "reload");
  await connection.inbox.wait(message => message.event === "operation.finished" && message.data.requestId === "reload");
  connection.send("session.list", "list");
  const inventory = await connection.inbox.wait(message => message.requestId === "list");
  expect(receipt).toMatchObject({ ok: true, result: { state: "accepted" } });
  expect(inventory.result.sessions[0].sessionId).toBe(sessionId); expect(reload).toHaveBeenCalledOnce();
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
