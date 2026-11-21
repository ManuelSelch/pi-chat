import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PiClient } from "../src/client.js";
import { fakeTransport } from "./fake-transport.js";
import type { Event } from "../src/protocol/v2.js";
import { snap, summary, initialized, event } from "./v2-fixtures.js";
import { themeFixture } from "./theme-fixture.js";
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
it.each(["session.open", "session.create"] as const)("caches the %s palette separately from session snapshots", async method => {
  const t = setup(); t.ready();
  const opened = t.client.request(method, method === "session.open" ? { sessionPath: "/saved" } : {});
  t.reply({ summary: summary(), snapshot: snap(), theme: themeFixture }); await opened;
  expect(t.client.getState().themes.s).toEqual(themeFixture);
  expect(Object.isFrozen(t.client.getState().themes.s?.colors)).toBe(true);
  t.socket.message({ ...event("session.snapshot", snap("s", 2)), sessionId: "s" });
  t.socket.message({ ...event("presentation.changed", { revision: 1, widgets: [], footer: [], extensions: { buttons: [], badges: [], state: {} } }), sessionId: "s" });
  const reload = t.client.reloadSession("s"); t.reply({ state: "accepted", operationId: "reload" }); await reload;
  expect(t.client.getState().themes.s).toEqual(themeFixture);
  expect(t.requests().map(request => request.method)).toEqual(["server.initialize", method, "session.reload"]);
  t.client.dispose();
});
it("stores palettes before publishing the opened session and keeps runtimes independent", async () => {
  const t = setup(); t.ready([]);
  const observations: unknown[] = [];
  t.client.subscribe(state => { if (state.sessions.a) observations.push(state.themes.a); });
  const first = t.client.createSession(); t.reply({ summary: summary("a"), snapshot: snap("a"), theme: themeFixture }); await first;
  expect(observations.length).toBeGreaterThan(0); expect(observations.every(value => value === t.client.getState().themes.a)).toBe(true);
  const light = { ...themeFixture, name: "paper-pine", appearance: "light" };
  const second = t.client.openSession("/second"); t.reply({ summary: summary("b"), snapshot: snap("b"), theme: light }); await second;
  expect(t.client.getState().themes).toEqual({ a: themeFixture, b: light });
  const reopen = t.client.openSession("/first"); t.reply({ summary: summary("a"), snapshot: snap("a"), theme: light }); await reopen;
  expect(t.client.getState().themes.a).toEqual(light); t.client.dispose();
});
it.each([undefined, null])("rejects open/create responses with theme %j without clearing cached palettes", async theme => {
  const t = setup(); t.ready();
  const first = t.client.openSession("/saved"); t.reply({ summary: summary(), snapshot: snap(), theme: themeFixture }); await first;
  const second = t.client.createSession(); const rejected = expect(second).rejects.toMatchObject({ code: "invalidMessage" });
  t.reply({ summary: summary(), snapshot: snap(), theme }); await rejected;
  expect(t.client.getState().connection.phase).toBe("failed");
  expect(t.client.getState().themes.s).toEqual(themeFixture); t.client.dispose();
});
it.each(["same", "different", "removed"] as const)("reconciles cached palettes on %s-server initialization", async kind => {
  const t = setup(); t.ready();
  const opened = t.client.openSession("/saved"); t.reply({ summary: summary(), snapshot: snap(), theme: themeFixture }); await opened;
  t.socket.end(); vi.advanceTimersByTime(250);
  const next = t.sockets[1]!; next.open();
  next.message({ version: 2, type: "response", requestId: JSON.parse(next.sent[0]!).requestId, ok: true, result: initialized(kind === "removed" ? [] : [snap()], kind === "different" ? "new-process" : "process") });
  expect(t.client.getState().themes).toEqual(kind === "same" ? { s: themeFixture } : {});
  t.client.dispose();
});
it.each(["close", "inventory", "replace"] as const)("clears palettes on runtime %s without transferring to a replacement", async kind => {
  const t = setup(); t.ready();
  const opened = t.client.openSession("/saved"); t.reply({ summary: summary(), snapshot: snap(), theme: themeFixture }); await opened;
  if (kind === "close") t.socket.message(event("session.closed", { reason: "requested" }, 1));
  else if (kind === "inventory") t.socket.message(event("session.list.changed", { revision: 1, sessions: [] }));
  else t.socket.message(event("session.replaced", { previousSessionId: "s", snapshot: snap("replacement") }));
  expect(t.client.getState().themes).toEqual({}); t.client.dispose();
});
it("treats prototype-like runtime IDs as ordinary palette keys", async () => {
  const t = setup(); t.ready([]);
  const opened = t.client.createSession(); t.reply({ summary: summary("__proto__"), snapshot: snap("__proto__"), theme: themeFixture }); await opened;
  expect(Object.hasOwn(t.client.getState().themes, "__proto__")).toBe(true);
  expect(t.client.getState().themes["__proto__"]).toEqual(themeFixture);
  expect(Object.getPrototypeOf(t.client.getState().themes)).toBe(Object.prototype); t.client.dispose();
});
it("does not populate palettes from initialization", () => {
  const t = setup(); t.ready();
  expect(t.client.getState().themes).toEqual({}); expect(t.client.getState().connection.phase).toBe("ready"); t.client.dispose();
});
it("does not automatically fight a replacement controller", () => {
  const t = setup(); t.ready(); t.socket.end(4001); vi.advanceTimersByTime(20_000); expect(t.sockets).toHaveLength(1);
  t.client.takeControl(); vi.advanceTimersByTime(0); expect(t.sockets).toHaveLength(2); t.client.dispose();
});
