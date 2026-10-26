import { expect, it } from "vitest";
import { initialSessionState, type ClientState, type ReadonlyDeep } from "@manuelselch/pi-sdk";
import { initialAppState, reduceAppMessage } from "../../../../../src/web/app/state/app-state.js";
import { snapshotEvent, coreEvent, presentationEvent } from "../../../../infra/v2-fixtures.js";
const session = { ...initialSessionState, sessionId: "s", sequence: 0, status: "idle" as const };
const sdk: ReadonlyDeep<ClientState> = { connection: { phase: "ready" }, capabilities: [], sessions: { s: session }, themes: {}, inventory: [], inventoryRevision: 0, projectsRevision: 0, catalogue: { projects: [] }, features: [] };
it("shares SDK transcript/draft objects rather than reducing incoming events twice", () => {
  const state = reduceAppMessage(initialAppState, { type: "sdkState", state: sdk, message: snapshotEvent({ sessionId: "s" }) }); expect(state.sessions.s?.messages).toBe(session.messages);
  const streamed = { ...session, sequence: 1, draft: { runId: "r", text: "already reduced", thinking: "" } };
  const next = reduceAppMessage(state, { type: "sdkState", state: { ...sdk, sessions: { s: streamed } }, message: coreEvent("message.delta", { runId: "r", delta: "must not append again" }, "s", 1) });
  expect(next.sessions.s?.draft).toBe(streamed.draft); expect(next.sessions.s?.draft?.text).toBe("already reduced");
});
it("keeps dismissed errors local until an authoritative failure snapshot", () => {
  const failed = { ...session, error: "run failed" }; let state = reduceAppMessage(initialAppState, { type: "sdkState", state: { ...sdk, sessions: { s: failed } }, message: snapshotEvent({ sessionId: "s" }) });
  state = reduceAppMessage(state, { type: "clearError", sessionId: "s" }); state = reduceAppMessage(state, { type: "sdkState", state: { ...sdk, sessions: { s: { ...failed, sequence: 1 } } }, message: presentationEvent({}, "s", 1) });
  expect(state.sessions.s?.error).toBeUndefined(); expect(failed.error).toBe("run failed");
  state = reduceAppMessage(state, { type: "sdkState", state: { ...sdk, sessions: { s: { ...failed, sequence: 2 } } }, message: snapshotEvent({ sessionId: "s", throughSequence: 2, runtime: { status: "idle", lastError: "run failed" } }) }); expect(state.sessions.s?.error).toBe("run failed");
});
it("ignores unsupported optional presentation hints in views while preserving core SDK data", () => {
  const extended = { ...session, widgets: [{ key: "future", lines: ["text"], placement: "unknown-slot" }], footer: [{ key: "x", text: "text", align: "future", variant: "new-style" }] };
  const state = reduceAppMessage(initialAppState, { type: "sdkState", state: { ...sdk, sessions: { s: extended } } }); expect(state.sessions.s?.widgets).toEqual([]); expect(state.sessions.s?.footer).toEqual([]); expect(extended.widgets).toHaveLength(1);
});
