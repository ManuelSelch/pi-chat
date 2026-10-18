import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PiClient } from "../src/client.js";
import { fakeTransport } from "./fake-transport.js";
import { snap, initialized, event } from "./v2-fixtures.js";
beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
function setup(options: Partial<ConstructorParameters<typeof PiClient>[0]> = {}) {
  const fake = fakeTransport(); const client = new PiClient({ endpoint: "ws://example.test/ws?client=test", transport: fake.factory, ...options });
  client.start(); vi.advanceTimersByTime(0); const socket = fake.sockets[0]!;
  const ready = (snapshots = [snap()], serverInstanceId = "process") => { socket.open(); socket.message({ version: 2, type: "response", requestId: JSON.parse(socket.sent.at(-1)!).requestId, ok: true, result: initialized(snapshots, serverInstanceId) }); };
  return { ...fake, client, socket, ready };
}
it("uses the explicit endpoint and initializes an empty server atomically", () => {
  const t = setup(); t.client.start(); expect(t.endpoints).toEqual(["ws://example.test/ws?client=test"]); expect(t.client.getState().connection.phase).toBe("connecting");
  t.ready([]); expect(t.client.getState().connection.phase).toBe("ready"); expect(t.sockets).toHaveLength(1); t.client.dispose(); expect(vi.getTimerCount()).toBe(0);
});
it("reconnects with capped backoff, disposes sockets and ignores obsolete callbacks", () => {
  const t = setup(); t.ready(); t.socket.message(event("message.delta", { runId: "r", delta: "partial" }, 1)); t.socket.end();
  expect(t.client.getSession("s")?.draft).toBeUndefined(); expect(t.socket.disposed).toBe(true);
  for (const delay of [250, 500, 1000, 2000, 4000, 5000, 5000]) {
    const count = t.sockets.length; vi.advanceTimersByTime(delay - 1); expect(t.sockets).toHaveLength(count); vi.advanceTimersByTime(1); expect(t.sockets).toHaveLength(count + 1);
    t.socket.end(4001); expect(t.client.getState().connection.phase).toBe("connecting"); t.sockets.at(-1)!.end();
  }
  t.client.dispose(); expect(vi.getTimerCount()).toBe(0);
});
it("does not reset retry backoff until successful initialization", () => {
  const t = setup(); t.socket.open(); t.socket.end(); vi.advanceTimersByTime(250); const next = t.sockets.at(-1)!; next.open(); next.end();
  const count = t.sockets.length; vi.advanceTimersByTime(499); expect(t.sockets).toHaveLength(count); vi.advanceTimersByTime(1); expect(t.sockets).toHaveLength(count + 1); t.client.dispose();
});
it("bounds connection/initialization waits and retries synchronous construction errors", () => {
  const t = setup({ connectTimeoutMs: 20 }); vi.advanceTimersByTime(20); expect(t.client.getState().connection.phase).toBe("reconnecting"); expect(t.socket.closed).toBe(true); t.client.dispose();
  const failing = new PiClient({ endpoint: "ws://example/ws", transport: () => { throw new Error("offline"); } }); failing.start(); vi.advanceTimersByTime(0); expect(failing.getState().connection.phase).toBe("reconnecting"); failing.dispose(); expect(vi.getTimerCount()).toBe(0);
});
it("fails explicitly on malformed JSON, required variants and oversized frames", () => {
  for (const raw of ["invalid JSON", JSON.stringify({ version: 1, type: "tabs" }), JSON.stringify({ version: 2, type: "event", event: "future" }), "x".repeat(101)]) {
    const t = setup({ maxMessageCharacters: 100 }); const errors = vi.fn(); t.client.onError(errors); t.socket.open(); t.socket.raw(raw);
    expect(t.client.getState().connection.phase).toBe("failed"); expect(errors).toHaveBeenCalled(); expect(t.socket.closed).toBe(true); t.client.dispose(); expect(vi.getTimerCount()).toBe(0);
  }
});
it("publishes immutable state, isolates subscriber failures and supports unsubscribe", () => {
  const t = setup(); const errors = vi.fn(); t.client.onError(errors); t.client.subscribe(() => { throw new Error("consumer"); });
  const listener = vi.fn(); const off = t.client.subscribe(listener); t.ready(); expect(errors).toHaveBeenCalled(); expect(listener).toHaveBeenCalled();
  expect(() => (t.client.getSession("s")!.messages as unknown[]).push({})).toThrow(); const count = listener.mock.calls.length; off();
  t.socket.message(event("message.delta", { runId: "r", delta: "text" }, 1)); expect(listener).toHaveBeenCalledTimes(count); t.client.dispose();
});
it("routes background sessions, prunes closed runtimes and exposes transient events", () => {
  const t = setup(); const events = vi.fn(); t.client.onMessage(events); t.ready([snap("a"), snap("b")]);
  t.socket.message(event("message.delta", { runId: "r", delta: "B" }, 1, "b")); t.socket.message(event("notification.created", { level: "info", message: "Notice" }, 1, "a"));
  expect(t.client.getSession("a")?.messages).toEqual([]); expect(t.client.getSession("b")?.draft?.text).toBe("B"); expect(events).toHaveBeenCalledWith(expect.objectContaining({ event: "notification.created" }));
  t.socket.message(event("session.list.changed", { revision: 1, sessions: [initialized([snap("b")]).inventory.sessions[0]] })); expect(t.client.getSession("a")).toBeUndefined(); t.client.dispose();
});
it("stops/disposes without closing runtimes and ignores detached callbacks", () => {
  const t = setup(); const listener = vi.fn(); t.client.subscribe(listener); t.ready(); t.client.stop();
  expect(t.socket.sent.map(s => JSON.parse(s).method)).toEqual(["server.initialize"]); expect(t.socket.closed).toBe(true);
  const count = listener.mock.calls.length; t.socket.message(event("message.delta", { runId: "r", delta: "late" }, 1)); vi.advanceTimersByTime(10_000); expect(listener).toHaveBeenCalledTimes(count);
  t.client.start(); vi.advanceTimersByTime(0); expect(t.sockets).toHaveLength(2); t.client.dispose(); t.client.dispose(); expect(() => t.client.start()).toThrow(/disposed/i); expect(() => t.client.subscribe(() => {})).toThrow(/disposed/i); expect(vi.getTimerCount()).toBe(0);
});
it("bounds reentrant required event queues", () => {
  const t = setup({ maxBufferedMessages: 2 }); t.ready(); t.client.onMessage(message => { if (message.type !== "event" || message.event !== "runtime.status") return;
    for (let sequence = 2; sequence <= 4; sequence++) t.socket.message(event("message.delta", { runId: "r", delta: "x" }, sequence)); });
  t.socket.message(event("runtime.status", { status: "running" }, 1)); expect(t.client.getState().connection.phase).toBe("failed"); expect(t.client.getSession("s")?.draft).toBeUndefined(); t.client.dispose(); expect(vi.getTimerCount()).toBe(0);
});
it("disposes transports closed synchronously during construction", () => {
  const close = vi.fn(); const dispose = vi.fn(); const client = new PiClient({ endpoint: "ws://example/ws", transport: (_url, events) => { events.close({ code: 4001 }); return { send() {}, close, dispose }; } });
  client.start(); vi.advanceTimersByTime(0); expect(client.getState().connection.phase).toBe("superseded"); expect(close).toHaveBeenCalledOnce(); expect(dispose).toHaveBeenCalledOnce(); client.dispose();
});
it("supports an open callback synchronous with transport construction", () => {
  const send = vi.fn(); const client = new PiClient({ endpoint: "ws://example/ws", transport: (_url, events) => { events.open(); return { send, close() {}, dispose() {} }; } });
  client.start(); vi.advanceTimersByTime(0); expect(send).toHaveBeenCalledOnce(); expect(JSON.parse(send.mock.calls[0]![0])).toMatchObject({ method: "server.initialize" }); client.dispose();
});
it("does not schedule duplicate connections during subscriber takeover", () => {
  const t = setup(); t.client.subscribe(state => { if (state.connection.phase === "reconnecting") t.client.takeControl(); }); t.socket.end(); vi.advanceTimersByTime(1000); expect(t.sockets).toHaveLength(2); t.client.dispose(); expect(vi.getTimerCount()).toBe(0);
});
it("makes stop terminal for synchronous subscriber reentry", () => {
  const t = setup(); t.client.subscribe(state => { if (state.connection.phase === "stopped") { t.client.stop(); t.client.start(); } }); t.client.stop(); vi.advanceTimersByTime(1000); expect(t.client.getState().connection.phase).toBe("stopped"); expect(t.sockets).toHaveLength(1); t.client.dispose();
});
it("bounds inventory and safely projects opaque object-prototype IDs", () => {
  const t = setup({ maxSessions: 1 }); t.ready([snap("a"), snap("b")]); expect(t.client.getState().connection.phase).toBe("failed"); t.client.dispose();
  const p = setup(); expect(p.client.getSession("toString")).toBeUndefined(); p.ready([snap("__proto__")]); expect(p.client.getSession("__proto__")?.sessionId).toBe("__proto__"); p.client.dispose();
});
it("replaces all state after a new process initialization, allowing lower watermarks", () => {
  const t = setup(); t.ready([snap("old", 100)]); t.socket.end(); vi.advanceTimersByTime(250); const next = t.sockets[1]!; next.open();
  next.message({ version: 2, type: "response", requestId: JSON.parse(next.sent[0]!).requestId, ok: true, result: initialized([snap("fresh", 0)], "restarted") });
  expect(t.client.getSession("old")).toBeUndefined(); expect(t.client.getSession("fresh")?.sequence).toBe(0); expect(t.client.getState().serverInstanceId).toBe("restarted"); t.client.dispose();
});
