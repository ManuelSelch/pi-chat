import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PiClient } from "../src/client.js";
import { fakeTransport } from "./fake-transport.js";
import type { Event } from "../src/protocol/v2.js";
import { snap, summary, initialized, event } from "./v2-fixtures.js";
beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
function setup(options: Partial<ConstructorParameters<typeof PiClient>[0]> = {}) {
  const fake = fakeTransport(); const client = new PiClient({ endpoint: "ws://example/ws", transport: fake.factory, ...options });
  client.start(); vi.advanceTimersByTime(0); const socket = fake.sockets[0]!; socket.open();
  const requests = () => socket.sent.map(s => JSON.parse(s));
  const reply = (result: unknown, id = requests().at(-1).requestId) => socket.message({ version: 2, type: "response", requestId: id, ok: true, result });
  const ready = (snapshots = [snap()]) => reply(initialized(snapshots), requests()[0].requestId);
  return { ...fake, client, socket, requests, reply, ready };
}
it("initializes atomically, validates correlated method result and exposes immutable structured state", () => {
  const t = setup(); expect(t.requests()[0]).toMatchObject({ version: 2, type: "request", method: "server.initialize" });
  expect(t.client.getState().connection.phase).toBe("synchronizing"); expect(t.client.getState().inventory).toEqual([]);
  t.ready(); expect(t.client.getState().connection.phase).toBe("ready"); expect(t.client.getState().serverInstanceId).toBe("process");
  expect(t.client.getSession("s")?.settings.model).toBe("test/model"); expect(Object.isFrozen(t.client.getSession("s"))).toBe(true);
  t.client.dispose(); expect(vi.getTimerCount()).toBe(0);
});
it("correlates all requests, separates acceptance and settlement and never fabricates navigation", async () => {
  const t = setup(); t.ready(); const pending = t.client.prompt("s", "hello");
  expect(t.requests().at(-1)).toMatchObject({ method: "message.send", sessionId: "s", params: { message: "hello" } });
  t.reply({ state: "accepted", operationId: "op" }); await expect(pending).resolves.toEqual({ state: "accepted", operationId: "op" });
  t.socket.message(event("operation.finished", { operationId: "op", requestId: t.requests().at(-1).requestId, outcome: "failed", error: { code: "providerError", message: "failed" } }, 1));
  expect(t.client.getSession("s")?.lastOperation?.outcome).toBe("failed"); expect(t.client.getSession("s")?.messages).toEqual([]); t.client.dispose();
});
it("rejects v1 and unknown required events and malformed method-specific responses", async () => {
  for (const value of [{ version: 1, type: "snapshot" }, event("future.required" as Event["event"], {}), { version: 2, type: "response", requestId: "sdk-1", ok: true, result: {} }]) {
    const t = setup(); t.socket.message(value); expect(t.client.getState().connection.phase).toBe("failed"); t.client.dispose();
  }
});
it("does not apply stale snapshots or duplicate events and uses snapshot watermarks", () => {
  const t = setup(); t.ready(); t.socket.message(event("message.delta", { runId: "r", delta: "hello" }, 1));
  t.socket.message(event("message.delta", { runId: "r", delta: "duplicate" }, 1));
  t.socket.message({ ...event("session.snapshot", snap("s", 0)), sessionId: "s" });
  expect(t.client.getSession("s")?.draft?.text).toBe("hello"); expect(t.client.getSession("s")?.sequence).toBe(1); t.client.dispose();
});
it("buffers gaps boundedly and requests one fresh snapshot without replaying mutations", async () => {
  const t = setup(); t.ready(); t.socket.message(event("message.delta", { runId: "r", delta: "third" }, 3));
  expect(t.requests().at(-1)).toMatchObject({ method: "session.snapshot", sessionId: "s" });
  t.socket.message(event("message.delta", { runId: "r", delta: "fourth" }, 4));
  expect(t.requests().filter(r => r.method === "session.snapshot")).toHaveLength(1);
  t.reply(snap("s", 3)); await Promise.resolve();
  expect(t.client.getSession("s")?.sequence).toBe(4); expect(t.client.getSession("s")?.draft?.text).toBe("fourth"); t.client.dispose();
});
it("rejects pending work as unknown on disconnect and initializes again without mutation replay", async () => {
  const t = setup(); t.ready(); const work = t.client.prompt("s", "once"); const rejected = expect(work).rejects.toMatchObject({ outcome: "unknown" });
  t.socket.end(); await rejected; vi.advanceTimersByTime(250); const next = t.sockets[1]!; next.open();
  expect(next.sent.map(s => JSON.parse(s).method)).toEqual(["server.initialize"]); t.client.dispose();
});
it("keeps local cancellation/timeouts uncertain and preserves structured server rejection", async () => {
  const t = setup({ requestTimeoutMs: 20 }); t.ready();
  const wait = t.client.pinProject("/project", true); const timed = expect(wait).rejects.toMatchObject({ code: "timeout", outcome: "unknown" }); vi.advanceTimersByTime(20); await timed;
  const abort = new AbortController(); const pending = t.client.browseDirectories({ path: "/" }, { signal: abort.signal }); const cancelled = expect(pending).rejects.toMatchObject({ code: "cancelled", outcome: "unknown" }); abort.abort(); await cancelled;
  const denied = t.client.openFile("s", "x"); const result = expect(denied).rejects.toMatchObject({ code: "notFound", outcome: "rejected", details: { reason: "missing" } });
  t.socket.message({ version: 2, type: "response", requestId: t.requests().at(-1).requestId, ok: false, error: { code: "notFound", message: "Missing", details: { reason: "missing" } } }); await result; t.client.dispose(); expect(vi.getTimerCount()).toBe(0);
});
it("rejects invalid initialization inventories instead of becoming partially ready", () => {
  const t = setup(); const state = initialized(); state.inventory.sessions = []; t.reply(state); expect(t.client.getState().connection.phase).toBe("failed"); t.client.dispose();
});
it("ignores old process events and prevents closed identities being recreated", () => {
  const t = setup(); t.ready(); t.socket.message(event("message.delta", { runId: "r", delta: "old" }, 1, "s", "other"));
  expect(t.client.getSession("s")?.draft).toBeUndefined();
  t.socket.message(event("session.closed", { reason: "requested" }, 1)); t.socket.message(event("message.delta", { runId: "r", delta: "late" }, 2));
  expect(t.client.getSession("s")).toBeUndefined(); t.client.dispose();
});
it("accepts additive data and unknown optional rendering hints without corrupting core state", () => {
  const t = setup(); const s = snap(); s.presentation = { revision: 3, widgets: [{ key: "w", placement: "future-slot", lines: ["text"] }], footer: [], extensions: { buttons: [], badges: [], state: {} } };
  t.reply({ ...initialized([s]), additive: true }); expect(t.client.getSession("s")?.widgets[0]?.placement).toBe("future-slot"); t.client.dispose();
});
it("bounds pending requests and rejects unsent work locally", async () => {
  const t = setup({ maxPendingRequests: 1 }); t.ready(); const first = t.client.prompt("s", "one"); const ended = expect(first).rejects.toMatchObject({ outcome: "unknown" });
  await expect(t.client.prompt("s", "two")).rejects.toMatchObject({ code: "limitExceeded", outcome: "notSent" }); t.client.dispose(); await ended;
});
it("coalesces identical file activations but keeps independently cancellable waits separate", async () => {
  const t = setup(); t.ready(); const first = t.client.openFile("s", "a.pdf"); expect(t.client.openFile("s", "a.pdf")).toBe(first);
  const independent = t.client.openFile("s", "a.pdf", { signal: new AbortController().signal }); expect(independent).not.toBe(first);
  const requests = t.requests().slice(1); expect(requests).toHaveLength(2);
  for (const request of requests) t.reply({ state: "completed" }, request.requestId);
  await Promise.all([first, independent]); t.client.dispose();
});
it("rejects events before the initialization barrier", () => {
  const t = setup(); t.socket.message(event("message.delta", { runId: "r", delta: "early" }, 1)); expect(t.client.getState().connection.phase).toBe("failed"); t.client.dispose();
});
it("replaces a runtime atomically and keeps its inventory position", () => {
  const t = setup(); t.ready([snap("a"), snap("b")]);
  const notifications: string[] = []; t.client.subscribe(() => notifications.push("state"));
  t.socket.message(event("session.replaced", { previousSessionId: "b", snapshot: snap("worktree") }));
  expect(t.client.getSession("b")).toBeUndefined(); expect(t.client.getSession("worktree")?.sessionId).toBe("worktree");
  expect(t.client.getState().inventory.map(entry => entry.sessionId)).toEqual(["a", "worktree"]);
  expect(notifications).toEqual(["state"]); t.client.dispose();
});
it("does not resurrect an already closed identity from a late replacement event", () => {
  const t = setup(); t.ready(); t.socket.message(event("session.closed", { reason: "requested" }, 1));
  t.socket.message(event("session.replaced", { previousSessionId: "s", snapshot: snap("late") })); expect(t.client.getSession("late")).toBeUndefined(); t.client.dispose();
});
it("fails boundedly when a recovery snapshot cannot heal the observed sequence gap", async () => {
  const t = setup(); t.ready(); t.socket.message(event("message.delta", { runId: "r", delta: "gap" }, 3)); t.reply(snap("s", 0)); await Promise.resolve();
  expect(t.client.getState().connection.phase).toBe("failed"); expect(t.requests().filter(r => r.method === "session.snapshot")).toHaveLength(1); t.client.dispose();
});
it("does not automatically fight a replacement controller", () => {
  const t = setup(); t.ready(); t.socket.end(4001); vi.advanceTimersByTime(20_000); expect(t.sockets).toHaveLength(1);
  t.client.takeControl(); vi.advanceTimersByTime(0); expect(t.sockets).toHaveLength(2); t.client.dispose();
});
