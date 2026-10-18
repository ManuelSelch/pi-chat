import { expect, it } from "vitest";
import { applySnapshot, initialSessionState, reduceSessionMessage } from "../src/session-state.js";
import { eventSchema, type Event } from "../src/contract/v2.js";
import { snap, event } from "./v2-fixtures.js";
const reduce = (state = applySnapshot(initialSessionState, snap()), value: unknown) => reduceSessionMessage(state, eventSchema.parse(value) as Extract<Event, { sessionId: string }>);
it("preserves observed same-connection drafts across running snapshots, but not different runs", () => {
  const state = reduce(undefined, event("message.delta", { runId: "r", delta: "partial" }, 1)); expect(state.draft?.text).toBe("partial");
  const snapshot = snap("s", 2); snapshot.runtime = { status: "running", runId: "r" }; expect(applySnapshot(state, snapshot).draft).toBe(state.draft); expect(applySnapshot(state, snapshot).status).toBe("running");
  snapshot.runtime.runId = "different"; expect(applySnapshot(state, snapshot).draft).toBeUndefined();
});
it("drops drafts on disconnect, rejects same-process stale snapshots and restores error state", () => {
  const state = reduce(undefined, event("message.delta", { runId: "r", delta: "partial" }, 3));
  expect(reduceSessionMessage(state, { type: "connectionLost" }).draft).toBeUndefined(); expect(applySnapshot(state, snap("s", 0))).toBe(state);
  const snapshot = snap("s", 4); snapshot.runtime.lastError = "provider failed"; expect(applySnapshot(state, snapshot).error).toBe("provider failed");
});
it("keeps notifications transient and consumes their core watermark", () => {
  const state = reduce(undefined, event("notification.created", { level: "info", message: "Notice" }, 1)); expect(state.sequence).toBe(1); expect(state.messages).toEqual([]);
});
it("merges running tool cards and never rewinds finalized tools", () => {
  const running = reduce(undefined, event("tool.updated", { runId: "r", tool: { toolCallId: "t", name: "read", status: "running", argsText: "file" } }, 1));
  const finished = reduce(running, event("tool.updated", { runId: "r", tool: { toolCallId: "t", name: "read", status: "success", outputText: "done" } }, 2));
  expect(finished.messages[0]).toMatchObject({ tool: { argsText: "file", outputText: "done", status: "success" } });
  expect(reduce(finished, event("tool.updated", { runId: "r", tool: { toolCallId: "t", name: "read", status: "running" } }, 3)).messages).toBe(finished.messages);
});
it("deduplicates finalized history and clears only assistant drafts", () => {
  const draft = reduce(undefined, event("message.delta", { runId: "r", delta: "answer" }, 1));
  const user = reduce(draft, event("message.finalized", { runId: "r", message: { id: "u", role: "user", text: "ask" } }, 2)); expect(user.draft).toBeDefined();
  const final = reduce(user, event("message.finalized", { runId: "r", message: { id: "a", role: "assistant", text: "answer", thinking: "reason" } }, 3)); expect(final.draft).toBeUndefined();
  expect(reduce(final, event("message.finalized", { runId: "r", message: { id: "a", role: "assistant", text: "answer", thinking: "reason" } }, 4)).messages).toBe(final.messages);
  const next = reduce(final, event("message.delta", { runId: "next", delta: "new draft" }, 4));
  expect(reduce(next, event("message.finalized", { runId: "r", message: { id: "a", role: "assistant", text: "updated answer" } }, 5)).draft).toBe(next.draft);
});
it("revisions optional presentation independently from core sequences", () => {
  const presentation = { revision: 10, widgets: [{ key: "w", placement: "future", lines: ["data"] }], footer: [], extensions: { buttons: [], badges: [], state: {} } };
  const state = reduce(undefined, { ...event("presentation.changed", presentation), sessionId: "s" }); expect(state.sequence).toBe(0); expect(state.widgets).toEqual(presentation.widgets);
  expect(reduce(state, { ...event("presentation.changed", { ...presentation, revision: 9, widgets: [] }), sessionId: "s" })).toBe(state);
});
