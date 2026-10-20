import { afterEach, beforeEach, expect, it } from "vitest";
import { activeSession, initialAppState, visibleError, visibleTabs, atHome, reduceAppMessage, type AppState } from "../../../../../src/web/app/state/app-state.js";
import { snapshotData, snapshotEvent, coreEvent, summary } from "../../../../infra/v2-fixtures.js";
import { createAppReducer } from "./sdk-harness.js";
let harness: ReturnType<typeof createAppReducer>; let state: AppState;
beforeEach(() => { harness = createAppReducer(); state = harness.initialize(initialAppState, [snapshotData({ sessionId: "a", messages: [{ id: "a-1", role: "user", text: "first" }] }), snapshotData({ sessionId: "b", messages: [{ id: "b-1", role: "user", text: "second" }] })]); });
afterEach(() => harness.client.dispose());
it("keeps separate transcripts and sequences for busy and background sessions", () => {
  for (let sequence = 1; sequence <= 5; sequence++) state = harness.reduce(state, coreEvent("message.delta", { runId: "r", delta: "x" }, "b", sequence));
  state = harness.reduce(state, coreEvent("message.delta", { runId: "r", delta: "kept" }, "a", 1));
  expect(state.sessions.a?.draft?.text).toBe("kept"); expect(state.sessions.b?.draft?.text).toBe("xxxxx"); expect(state.sessions.a?.messages).toHaveLength(1);
});
it("focuses locally with no wire command and retains focus through inventory updates", () => {
  state = harness.reduce(state, { type: "focusSession", sessionId: "b" }); expect(state.activeSessionId).toBe("b");
  state = harness.reduce(state, { version: 2, type: "event", serverInstanceId: "process", event: "session.list.changed", data: { revision: 1, sessions: [summary(snapshotData({ sessionId: "a" })), summary(snapshotData({ sessionId: "b" }))] } });
  expect(state.activeSessionId).toBe("b"); expect(activeSession(state).messages[0]).toMatchObject({ text: "second" });
});
it("keeps the selected tab when a worktree switch replaces its runtime", () => {
  state = harness.reduce(state, { type: "focusSession", sessionId: "b" });
  const replacement = snapshotData({ sessionId: "worktree", projectPath: "/project-worktree" });

  state = harness.reduce(state, { version: 2, type: "event", serverInstanceId: "process", event: "session.replaced", data: { previousSessionId: "b", snapshot: replacement } });
  // Handoff is atomic: the selected tab is already the replacement before the
  // authoritative inventory replacement arrives.
  expect(state.activeSessionId).toBe("worktree");
  expect(state.tabs.map(tab => tab.sessionId)).toContain("worktree");

  state = harness.reduce(state, { version: 2, type: "event", serverInstanceId: "process", event: "session.list.changed", data: { revision: 1, sessions: [summary(snapshotData({ sessionId: "a" })), summary(replacement)] } });
  expect(state.activeSessionId).toBe("worktree");
});
it("replaces a background runtime without stealing focus", () => {
  state = harness.reduce(state, { type: "focusSession", sessionId: "a" });
  const replacement = snapshotData({ sessionId: "worktree", projectPath: "/project-worktree" });
  state = harness.reduce(state, { version: 2, type: "event", serverInstanceId: "process", event: "session.replaced", data: { previousSessionId: "b", snapshot: replacement } });
  expect(state.activeSessionId).toBe("a");
  expect(state.tabs.map(tab => tab.sessionId)).toEqual(["a", "worktree"]);
});
it("restores local focus when the selected runtime survives reconnect and falls back when it does not", () => {
  state = harness.reduce(state, { type: "focusSession", sessionId: "b" });
  state = harness.reduce(state, { type: "connectionLost" });
  state = harness.initialize(state, [snapshotData({ sessionId: "a" }), snapshotData({ sessionId: "b" })]);
  expect(state.activeSessionId).toBe("b");
  state = harness.reduce(state, { type: "connectionLost" });
  state = harness.initialize(state, [snapshotData({ sessionId: "a" }), snapshotData({ sessionId: "c" })]);
  expect(state.activeSessionId).toBe("a");
  expect(state.sessions.b).toBeUndefined();
});
it("prunes closed projections and selects a remaining visible conversation", () => {
  state = harness.reduce(state, coreEvent("session.closed", { reason: "requested" }, "a", 1)); expect(state.sessions.a).toBeUndefined(); expect(state.activeSessionId).toBe("b");
});
it("ignores stale correlated results without transcript, error or navigation changes", () => {
  const previous = { ...state, error: "existing" }; expect(harness.reduce(previous, { version: 2, type: "response", requestId: "missing", ok: false, error: { code: "notFound", message: "file missing" } })).toBe(previous);
});
it("retains each transcript on connection loss and clears only connection error on ready", () => {
  state = harness.reduce(state, { type: "focusSession", sessionId: "b" }); state = harness.reduce(state, { type: "connectionLost" });
  expect(state.error).toBe("Waiting for the Pi Chat server…"); expect(state.sessions.a?.messages).toHaveLength(1); expect(state.sessions.b?.status).toBe("connecting");
  state = harness.initialize(state, [snapshotData({ sessionId: "a" }), snapshotData({ sessionId: "b" })]); expect(state.connection).toBe("open"); expect(state.error).toBeUndefined(); expect(state.activeSessionId).toBe("b");
});
it("surfaces fatal protocol rejection app-wide rather than hiding it behind Home", () => {
  state = harness.reduce(state, { version: 2, type: "protocolError", serverInstanceId: "process", error: { code: "unsupportedVersion", message: "Only v2 is supported" } });
  expect(visibleError(state, activeSession(state))).toContain("Only v2 is supported");
});
it("dismisses a session error locally without changing SDK or other sessions", () => {
  state = harness.reduce(state, coreEvent("runtime.status", { status: "idle", lastError: "a failed" }, "a", 1));
  state = harness.reduce(state, coreEvent("runtime.status", { status: "idle", lastError: "b failed" }, "b", 1)); state = harness.reduce(state, { type: "clearError", sessionId: "a" });
  expect(state.sessions.a?.error).toBeUndefined(); expect(harness.client.getSession("a")?.error).toBe("a failed"); expect(state.sessions.b?.error).toBe("b failed");
});
it("keeps dismissed errors hidden until a new authoritative failure arrives", () => {
  state = harness.reduce(state, coreEvent("runtime.status", { status: "idle", lastError: "failed" }, "a", 1)); state = harness.reduce(state, { type: "clearError", sessionId: "a" });
  state = harness.reduce(state, coreEvent("message.delta", { runId: "r", delta: "text" }, "a", 2)); expect(state.sessions.a?.error).toBeUndefined();
  state = harness.reduce(state, snapshotEvent({ sessionId: "a", throughSequence: 3, runtime: { status: "idle", lastError: "failed" } })); expect(state.sessions.a?.error).toBe("failed");
});
it("hides a closing tab optimistically and restores it with original focus on failure", () => {
  state = harness.reduce(state, { type: "closePending", sessionId: "a" }); expect(visibleTabs(state).map(tab => tab.sessionId)).toEqual(["b"]); expect(state.tabs).toHaveLength(2);
  const once = state; expect(harness.reduce(state, { type: "closePending", sessionId: "a" })).toBe(once);
  state = harness.reduce(state, { type: "commandFailed", closingSessionId: "a", error: "partial close; retry" }); expect(visibleTabs(state)).toHaveLength(2); expect(state.activeSessionId).toBe("a");
});
it("settles opening placeholders per correlated operation, not arbitrary inventory traffic", () => {
  state = harness.reduce(state, { type: "openPending" }); state = harness.reduce(state, { type: "openPending" }); expect(state.openingTabs).toBe(2);
  state = harness.reduce(state, { type: "sessionOpened", sessionId: "b" }); expect(state.openingTabs).toBe(1); expect(state.activeSessionId).toBe("b");
  state = harness.reduce(state, { type: "commandFailed", opening: true, error: "failed" }); expect(state.openingTabs).toBe(0);
});
it("does not show Home before initialization or while opening a session", () => {
  expect(atHome(initialAppState)).toBe(false); const home = reduceAppMessage(state, { type: "sdkState", state: { ...harness.client.getState(), inventory: [], sessions: {} } }); expect(atHome(home)).toBe(true);
  expect(atHome(harness.reduce(home, { type: "openPending" }))).toBe(false);
});
it("keeps project catalogue available at Home without a runtime", () => {
  const catalogue = { projects: [{ path: "/p", displayPath: "/p", name: "p", exists: true, modified: 1, sessionCount: 0, sessions: [] }] };
  state = harness.reduce(state, { version: 2, type: "event", serverInstanceId: "process", event: "project.list.changed", data: { revision: 1, catalogue } }); expect(state.catalogue).toEqual(catalogue);
});
it("adds browser notices once without adding any SDK transcript entries", () => {
  state = harness.reduce(state, coreEvent("notification.created", { level: "info", message: "notice" }, "a", 1));
  const notified = state; state = harness.reduce(state, coreEvent("notification.created", { level: "info", message: "notice" }, "a", 1)); expect(state.sessions.a).toBe(notified.sessions.a);
  expect(state.sessions.a?.messages.at(-1)).toMatchObject({ role: "notice", text: "notice" }); expect(harness.client.getSession("a")?.messages).toHaveLength(1);
});
