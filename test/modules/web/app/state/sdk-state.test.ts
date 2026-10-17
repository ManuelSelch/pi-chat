import { describe, expect, it } from "vitest";
import { initialSessionState, type ClientState, type ReadonlyDeep } from "@manuelselch/pi-sdk";
import { initialAppState, reduceAppMessage } from "../../../../../src/web/app/state/app-state.js";

const session = { ...initialSessionState, sessionId: "s", sequence: 0, status: "idle" as const };
const sdk: ReadonlyDeep<ClientState> = { connection: { phase: "ready" }, sessions: { s: session }, inventory: [], serverActiveSessionId: "s", catalogue: { projects: [] }, features: [] };
const snapshot = { version: 1 as const, type: "snapshot" as const, sessionId: "s", sequence: 0, throughSequence: 0, projectPath: "/p", messages: [], isStreaming: false };

describe("SDK-owned web projection", () => {
  it("reuses SDK session objects instead of reducing raw events a second time", () => {
    const state = reduceAppMessage(initialAppState, { type: "sdkState", state: sdk, message: snapshot });
    expect(state.sessions.s).toBe(session);
    const streamed = { ...session, sequence: 1, draft: { runId: "r", text: "already reduced", thinking: "" } };
    const next = reduceAppMessage(state, { type: "sdkState", state: { ...sdk, sessions: { s: streamed } }, message: { version: 1, type: "assistantDelta", sessionId: "s", sequence: 1, runId: "r", delta: "must not append again" } });
    expect(next.sessions.s).toBe(streamed);
    expect(next.sessions.s?.draft?.text).toBe("already reduced");
  });

  it("keeps dismissed errors local across unrelated SDK publications", () => {
    const failed = { ...session, error: "run failed" };
    let state = reduceAppMessage(initialAppState, { type: "sdkState", state: { ...sdk, sessions: { s: failed } }, message: snapshot });
    state = reduceAppMessage(state, { type: "clearError", sessionId: "s" });
    state = reduceAppMessage(state, { type: "sdkState", state: { ...sdk, sessions: { s: { ...failed, sequence: 1 } } }, message: { version: 1, type: "widgets", sessionId: "s", sequence: 1, widgets: [] } });
    expect(state.sessions.s?.error).toBeUndefined();
    expect(failed.error).toBe("run failed");
    state = reduceAppMessage(state, { type: "sdkState", state: { ...sdk, sessions: { s: { ...failed, sequence: 2 } } }, message: { ...snapshot, sequence: 2, throughSequence: 2, lastError: "run failed" } });
    expect(state.sessions.s?.error).toBe("run failed");
  });

  it("adds notices only for accepted SDK notifications, never to SDK history", () => {
    let state = reduceAppMessage(initialAppState, { type: "sdkState", state: sdk, message: snapshot });
    const notified = { ...session, sequence: 1 };
    const message = { version: 1 as const, type: "notification" as const, sessionId: "s", sequence: 1, level: "info" as const, message: "notice" };
    const nextSDK = { ...sdk, sessions: { s: notified } };
    state = reduceAppMessage(state, { type: "sdkState", state: nextSDK, message });
    expect(state.sessions.s?.messages.map((entry) => entry.id)).toEqual(["notice:1"]);
    expect(notified.messages).toEqual([]);
    const before = state.sessions.s;
    state = reduceAppMessage(state, { type: "sdkState", state: nextSDK, message });
    expect(state.sessions.s).toBe(before);
  });
});
