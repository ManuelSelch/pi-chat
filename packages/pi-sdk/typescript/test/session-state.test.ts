import { describe, expect, it } from "vitest";
import { initialSessionState, reduceSessionMessage } from "../src/session-state.js";

describe("framework-independent session projection", () => {
  const snapshot = { version: 1 as const, type: "snapshot" as const, sessionId: "s", sequence: 5, throughSequence: 5, projectPath: "/project", messages: [], isStreaming: true, steeringMessages: ["again", "again"] };

  it("restores snapshots and preserves a same-session running draft", () => {
    const state = reduceSessionMessage(initialSessionState, snapshot);
    const streaming = reduceSessionMessage(state, { version: 1, type: "assistantDelta", sessionId: "s", sequence: 6, runId: "run", delta: "Hello" });
    expect(reduceSessionMessage(streaming, { ...snapshot, sequence: 7, throughSequence: 7 }).draft?.text).toBe("Hello");
    expect(state.steeringMessages).toEqual(["again", "again"]);
    expect(state.messages).toEqual([]);
    expect(reduceSessionMessage(streaming, { version: 1, type: "thinkingDelta", sessionId: "s", sequence: 6, runId: "run", delta: "stale" })).toBe(streaming);
  });

  it("drops incomplete drafts on disconnect and accepts a restarted lower snapshot", () => {
    const streaming = { ...initialSessionState, sessionId: "s", sequence: 50, draft: { runId: "r", text: "partial", thinking: "" } };
    const lost = reduceSessionMessage(streaming, { type: "connectionLost" });
    expect(lost.draft).toBeUndefined();
    expect(reduceSessionMessage(lost, snapshot).sequence).toBe(5);
  });

  it("does not invent browser notice bubbles for notifications", () => {
    const next = reduceSessionMessage(initialSessionState, { version: 1, type: "notification", sessionId: "s", sequence: 1, level: "info", message: "Transient" });
    expect(next.messages).toEqual([]);
    expect(next.sequence).toBe(1);
  });
});
