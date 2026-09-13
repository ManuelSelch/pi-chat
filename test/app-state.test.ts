import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, type ChatMessage, type ServerMessage } from "../src/shared/protocol.js";
import { activeSession, initialAppState, reduceAppMessage } from "../src/web/chat/app-state.js";

const snapshot = (sessionId: string, text: string): ServerMessage => ({
  version: PROTOCOL_VERSION,
  type: "snapshot",
  sessionId,
  sequence: 0,
  throughSequence: 0,
  projectPath: "/project",
  messages: [{ id: `${sessionId}-1`, role: "user", text }],
  isStreaming: false,
});

const textOf = (message?: ChatMessage): string => (message && "text" in message ? message.text : "");

describe("app state", () => {
  it("keeps one transcript per session", () => {
    let state = reduceAppMessage(initialAppState, snapshot("a", "first"));
    state = reduceAppMessage(state, snapshot("b", "second"));

    state = reduceAppMessage(state, {
      version: PROTOCOL_VERSION, type: "assistantDelta", sessionId: "b", sequence: 1, runId: "r", delta: "hello",
    });

    expect(state.sessions.a!.draft).toBeUndefined();
    expect(state.sessions.b!.draft?.text).toBe("hello");
    expect(state.sessions.a!.messages).toHaveLength(1);
  });

  it("does not let a busy tab's sequence suppress a quiet tab", () => {
    let state = reduceAppMessage(initialAppState, snapshot("a", "first"));
    state = reduceAppMessage(state, snapshot("b", "second"));

    // Session b races ahead; session a's low sequence must still be applied.
    for (let sequence = 1; sequence <= 5; sequence++) {
      state = reduceAppMessage(state, {
        version: PROTOCOL_VERSION, type: "assistantDelta", sessionId: "b", sequence, runId: "r", delta: "x",
      });
    }
    state = reduceAppMessage(state, {
      version: PROTOCOL_VERSION, type: "assistantDelta", sessionId: "a", sequence: 1, runId: "r", delta: "kept",
    });

    expect(state.sessions.a!.draft?.text).toBe("kept");
  });

  it("tracks tabs and drops projections for closed ones", () => {
    let state = reduceAppMessage(initialAppState, snapshot("a", "first"));
    state = reduceAppMessage(state, snapshot("b", "second"));

    state = reduceAppMessage(state, {
      version: PROTOCOL_VERSION,
      type: "tabs",
      activeSessionId: "b",
      tabs: [{ sessionId: "b", title: "Second", projectPath: "/project", projectName: "project", status: "running" }],
    });

    expect(Object.keys(state.sessions)).toEqual(["b"]);
    expect(state.activeSessionId).toBe("b");
    expect(textOf(activeSession(state).messages[0])).toBe("second");
  });

  it("falls back to the only session before the tab list arrives", () => {
    const state = reduceAppMessage(initialAppState, snapshot("a", "first"));

    expect(state.activeSessionId).toBe("");
    expect(textOf(activeSession(state).messages[0])).toBe("first");
  });

  it("reports connection loss app-wide while keeping each transcript", () => {
    let state = reduceAppMessage(initialAppState, snapshot("a", "first"));
    state = reduceAppMessage(state, snapshot("b", "second"));

    state = reduceAppMessage(state, { type: "connectionLost", error: "gone" });

    expect(state.connection).toBe("connecting");
    expect(state.error).toBe("gone");
    expect(state.sessions.a!.messages).toHaveLength(1);
    expect(state.sessions.b!.status).toBe("connecting");
  });
});
