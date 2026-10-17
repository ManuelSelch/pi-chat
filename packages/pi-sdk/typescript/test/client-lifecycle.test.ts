import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PiClient } from "../src/client.js";
import { catalogue, fakeTransport, snapshot, tabs } from "./fake-transport.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function setup(options: Partial<ConstructorParameters<typeof PiClient>[0]> = {}) {
  const fake = fakeTransport();
  const client = new PiClient({ endpoint: "ws://example.test/ws?client=test", transport: fake.factory, ...options });
  client.start();
  vi.advanceTimersByTime(0);
  return { ...fake, client, socket: fake.sockets[0]! };
}

describe("PiClient v1 connection lifecycle", () => {
  it("uses the explicit endpoint and observes initial state without navigation", () => {
    const { client, socket, endpoints } = setup();
    expect(endpoints).toEqual(["ws://example.test/ws?client=test"]);
    expect(client.getState().connection.phase).toBe("connecting");
    socket.open();
    expect(client.getState().connection.phase).toBe("synchronizing");
    socket.message(tabs("s")); socket.message(catalogue);
    expect(client.getState().connection.phase).toBe("synchronizing");
    socket.message(snapshot());
    expect(client.getState().connection.phase).toBe("ready");
    expect(client.getState().serverActiveSessionId).toBe("s");
    expect(client.getSession("s")?.status).toBe("idle");
    client.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("handles an empty server and makes start idempotent", () => {
    const { client, socket, sockets } = setup(); client.start();
    socket.open(); socket.message(tabs()); socket.message(catalogue);
    expect(client.getState().connection.phase).toBe("ready");
    expect(sockets).toHaveLength(1);
    client.dispose();
  });

  it("reconnects with capped backoff, cleans listeners and rejects obsolete callbacks", () => {
    const { client, socket, sockets } = setup();
    socket.open(); socket.message(snapshot()); socket.message(tabs("s")); socket.message(catalogue);
    socket.message({ version: 1, type: "assistantDelta", sessionId: "s", sequence: 1, runId: "r", delta: "partial" });
    socket.end();
    expect(socket.disposed).toBe(true);
    expect(client.getSession("s")?.draft).toBeUndefined();
    vi.advanceTimersByTime(249); expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1); expect(sockets).toHaveLength(2);
    socket.open(); socket.message({ ...snapshot(), sessionName: "obsolete" }); socket.end(4001);
    expect(client.getState().connection.phase).toBe("connecting");
    sockets[1]!.end();
    vi.advanceTimersByTime(499); expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1); expect(sockets).toHaveLength(3);
    for (const delay of [1000, 2000, 4000, 5000, 5000]) {
      sockets.at(-1)!.end(); vi.advanceTimersByTime(delay - 1);
      const count = sockets.length; vi.advanceTimersByTime(1); expect(sockets).toHaveLength(count + 1);
    }
    sockets.at(-1)!.open(); sockets.at(-1)!.end();
    const count = sockets.length; vi.advanceTimersByTime(250); expect(sockets).toHaveLength(count + 1);
    client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("does not fight controller replacement; only explicit takeover reconnects", () => {
    const { client, socket, sockets } = setup(); socket.open(); socket.end(4001);
    expect(client.getState().connection.phase).toBe("superseded");
    client.start(); vi.advanceTimersByTime(100_000); expect(sockets).toHaveLength(1);
    client.takeControl(); vi.advanceTimersByTime(0); expect(sockets).toHaveLength(2);
    client.dispose();
  });

  it("bounds connection/readiness waits and retries synchronous factory failures", () => {
    const { client, sockets } = setup({ connectTimeoutMs: 20 });
    vi.advanceTimersByTime(20);
    expect(client.getState().connection.phase).toBe("reconnecting");
    expect(sockets[0]!.closed).toBe(true);
    client.dispose();
    const failing = new PiClient({ endpoint: "ws://example/ws", transport: () => { throw new Error("offline"); } });
    failing.start(); vi.advanceTimersByTime(0);
    expect(failing.getState().connection.phase).toBe("reconnecting");
    failing.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("fails explicitly on malformed/unknown required wire variants and oversize frames", () => {
    for (const raw of ["not JSON", JSON.stringify({ version: 2, type: "tabs" }), JSON.stringify({ version: 1, type: "future" }), "x".repeat(101)]) {
      const { client, socket } = setup({ maxMessageCharacters: 100 });
      const errors = vi.fn(); client.onError(errors); socket.open(); socket.raw(raw);
      expect(client.getState().connection.phase).toBe("failed");
      expect(errors).toHaveBeenCalled();
      expect(socket.closed).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      client.dispose();
    }
  });

  it("publishes immutable snapshots, isolates subscribers and supports unsubscribe", () => {
    const { client, socket } = setup();
    const errors = vi.fn(); client.onError(errors);
    client.subscribe(() => { throw new Error("consumer bug"); });
    const listener = vi.fn(); const unsubscribe = client.subscribe(listener);
    socket.open(); socket.message(snapshot());
    expect(errors).toHaveBeenCalled(); expect(listener).toHaveBeenCalled();
    const state = client.getState();
    expect(() => (state.sessions.s!.messages as unknown[]).push({})).toThrow();
    expect(Object.isFrozen(state.sessions.s)).toBe(true);
    const count = listener.mock.calls.length; unsubscribe(); socket.message(catalogue);
    expect(listener).toHaveBeenCalledTimes(count);
    expect(state).not.toBe(client.getState());
    client.dispose();
  });

  it("routes background sessions, prunes closed ones and exposes transient events", () => {
    const { client, socket } = setup(); const events = vi.fn(); client.onMessage(events);
    socket.open(); socket.message(snapshot("a")); socket.message(snapshot("b")); socket.message(tabs("a", "b")); socket.message(catalogue);
    socket.message({ version: 1, type: "assistantDelta", sessionId: "b", sequence: 1, runId: "r", delta: "B" });
    socket.message({ version: 1, type: "notification", sessionId: "a", sequence: 1, level: "info", message: "Notice" });
    expect(client.getSession("a")?.messages).toEqual([]);
    expect(client.getSession("b")?.draft?.text).toBe("B");
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ type: "notification" }));
    socket.message(tabs("b")); expect(client.getSession("a")).toBeUndefined();
    client.dispose();
  });

  it("stops/disposes without closing runtimes and cleans timers/subscriptions", () => {
    const { client, socket, sockets } = setup(); const listener = vi.fn(); client.subscribe(listener);
    client.stop(); expect(socket.sent).toEqual([]); expect(socket.closed).toBe(true); expect(socket.disposed).toBe(true);
    const count = listener.mock.calls.length; socket.message(snapshot()); vi.advanceTimersByTime(9999);
    expect(listener).toHaveBeenCalledTimes(count); expect(sockets).toHaveLength(1);
    client.start(); vi.advanceTimersByTime(0); expect(sockets).toHaveLength(2);
    client.dispose(); client.dispose(); expect(vi.getTimerCount()).toBe(0);
    expect(() => client.start()).toThrow(/disposed/i);
    expect(() => client.subscribe(() => {})).toThrow(/disposed/i);
  });

  it("bounds reentrant event queues instead of silently losing required events", () => {
    const { client, socket } = setup({ maxBufferedMessages: 2 });
    client.onMessage((message) => {
      if (message.type !== "snapshot") return;
      for (let sequence = 1; sequence <= 3; sequence++) socket.message({ version: 1, type: "assistantDelta", sessionId: "s", sequence, runId: "r", delta: "x" });
    });
    socket.open(); socket.message(snapshot());
    expect(client.getState().connection).toMatchObject({ phase: "failed", error: { code: "limitExceeded" } });
    expect(client.getSession("s")?.draft).toBeUndefined();
    client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("disposes a transport that closes synchronously during construction", () => {
    const close = vi.fn(); const dispose = vi.fn();
    const client = new PiClient({ endpoint: "ws://example/ws", transport: (_endpoint, handlers) => {
      handlers.close({ code: 4001 });
      return { send: vi.fn(), close, dispose };
    } });
    client.start(); vi.advanceTimersByTime(0);
    expect(client.getState().connection.phase).toBe("superseded");
    expect(close).toHaveBeenCalledOnce(); expect(dispose).toHaveBeenCalledOnce();
    client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("does not schedule duplicate connections when subscribers explicitly take over during reconnect", () => {
    const { client, socket, sockets } = setup();
    client.subscribe((state) => { if (state.connection.phase === "reconnecting") client.takeControl(); });
    socket.end(); vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("makes stop terminal for synchronous subscriber reentry", () => {
    const { client, sockets } = setup();
    client.subscribe((state) => { if (state.connection.phase === "stopped") { client.stop(); client.start(); } });
    client.stop(); vi.advanceTimersByTime(1000);
    expect(client.getState().connection.phase).toBe("stopped");
    expect(sockets).toHaveLength(1);
    client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds runtime inventory and projection counts", () => {
    for (const viaInventory of [true, false]) {
      const { client, socket } = setup({ maxSessions: 1 }); socket.open();
      if (viaInventory) socket.message(tabs("a", "b"));
      else { socket.message(snapshot("a")); socket.message(snapshot("b")); }
      expect(client.getState().connection).toMatchObject({ phase: "failed", error: { code: "limitExceeded" } });
      client.dispose(); expect(vi.getTimerCount()).toBe(0);
    }
  });

  it("safely handles opaque IDs that match Object prototype properties", () => {
    const { client, socket } = setup(); socket.open();
    expect(client.getSession("toString")).toBeUndefined();
    socket.message(snapshot("__proto__"));
    expect(client.getSession("__proto__")?.sessionId).toBe("__proto__");
    client.dispose();
  });
});
