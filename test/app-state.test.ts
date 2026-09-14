import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, type ChatMessage, type ServerMessage } from "../src/shared/protocol.js";
import { activeSession, initialAppState, reduceAppMessage, visibleError, visibleTabs, atHome } from "../src/web/chat/app-state.js";

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

describe("error reporting", () => {
  it("surfaces a protocol rejection that belongs to no session", () => {
    const state = reduceAppMessage(initialAppState, {
      version: PROTOCOL_VERSION,
      type: "protocolError",
      error: "Message does not match protocol version 1.",
    });

    expect(state.error).toBe("Message does not match protocol version 1.");
    // The regression: App rendered only the session error, so this was silent.
    expect(visibleError(state, activeSession(state))).toBe("Message does not match protocol version 1.");
  });

  it("prefers the session error when no protocol error is pending", () => {
    let state = reduceAppMessage(initialAppState, snapshot("a", "first"));
    state = reduceAppMessage(state, {
      version: PROTOCOL_VERSION, type: "runtimeStatus", sessionId: "a", sequence: 1, status: "idle", error: "run failed",
    });

    expect(visibleError(state, activeSession(state))).toBe("run failed");
  });

  it("clears a protocol rejection once another command is sent", () => {
    let state = reduceAppMessage(initialAppState, {
      version: PROTOCOL_VERSION, type: "protocolError", error: "nope",
    });
    state = reduceAppMessage(state, { type: "clearError" });

    expect(visibleError(state, activeSession(state))).toBeUndefined();
  });
});

describe("optimistic tab changes", () => {
  const tabsMessage = (ids: string[]) => ({
    version: PROTOCOL_VERSION,
    type: "tabs" as const,
    activeSessionId: ids[0] ?? "",
    tabs: ids.map((id) => ({ sessionId: id, title: id, projectPath: "/p", projectName: "p", status: "idle" as const })),
  });

  it("shows a placeholder while a session is being opened", () => {
    let state = reduceAppMessage(initialAppState, { type: "openPending" });
    state = reduceAppMessage(state, { type: "openPending" });

    expect(state.openingTabs).toBe(2);

    state = reduceAppMessage(state, tabsMessage(["a", "b"]));

    // The authoritative tab list replaces every guess.
    expect(state.openingTabs).toBe(0);
    expect(visibleTabs(state).map((tab) => tab.sessionId)).toEqual(["a", "b"]);
  });

  it("hides a closing tab before the server confirms", () => {
    let state = reduceAppMessage(initialAppState, tabsMessage(["a", "b"]));
    state = reduceAppMessage(state, { type: "closePending", sessionId: "a" });

    expect(visibleTabs(state).map((tab) => tab.sessionId)).toEqual(["b"]);
    // Still present underneath until the server says otherwise.
    expect(state.tabs).toHaveLength(2);

    state = reduceAppMessage(state, tabsMessage(["b"]));
    expect(state.closingSessionIds).toEqual([]);
    expect(visibleTabs(state).map((tab) => tab.sessionId)).toEqual(["b"]);
  });

  it("ignores a repeated close of the same tab", () => {
    let state = reduceAppMessage(initialAppState, tabsMessage(["a"]));
    state = reduceAppMessage(state, { type: "closePending", sessionId: "a" });
    const once = state;
    state = reduceAppMessage(state, { type: "closePending", sessionId: "a" });

    expect(state).toBe(once);
  });
});

describe("home screen", () => {
  const tabsMessage = (tabs: { sessionId: string; title: string }[]): ServerMessage => ({
    version: PROTOCOL_VERSION,
    type: "tabs",
    activeSessionId: tabs[0]?.sessionId ?? "",
    tabs: tabs.map((tab) => ({ ...tab, status: "idle", projectPath: "/p", projectName: "p" })),
  });

  it("is not shown before the first tab list arrives", () => {
    // Otherwise a fresh load flashes the home screen before its tabs land.
    expect(atHome(initialAppState)).toBe(false);
  });

  it("is shown once the last tab closes", () => {
    const open = reduceAppMessage(initialAppState, tabsMessage([{ sessionId: "a", title: "A" }]));
    expect(atHome(open)).toBe(false);

    const closed = reduceAppMessage(open, tabsMessage([]));
    expect(atHome(closed)).toBe(true);
  });

  it("is hidden while a tab is being opened from it", () => {
    const closed = reduceAppMessage(initialAppState, tabsMessage([]));
    const opening = reduceAppMessage(closed, { type: "openPending" });

    expect(atHome(opening)).toBe(false);
  });

  it("drops the closed session's transcript", () => {
    const open = reduceAppMessage(initialAppState, tabsMessage([{ sessionId: "a", title: "A" }]));
    const closed = reduceAppMessage(open, tabsMessage([]));

    expect(closed.sessions).toEqual({});
  });

  it("keeps a catalogue that arrives without any session", () => {
    const catalogue = { projects: [{ path: "/p", name: "p", exists: true, modified: 1, sessionCount: 0, sessions: [] }] };
    const next = reduceAppMessage(initialAppState, { version: PROTOCOL_VERSION, type: "catalogue", catalogue });

    expect(next.catalogue).toEqual(catalogue);
  });
});

describe("recovering from a server restart", () => {
  it("clears the connection error once state arrives again", () => {
    // A restart closes the socket, then the reconnect must take the banner down;
    // otherwise the UI claims to be waiting over a working connection.
    const lost = reduceAppMessage(initialAppState, { type: "connectionLost", error: "Waiting for the Pi Chat server…" });
    expect(lost.error).toBeDefined();

    const back = reduceAppMessage(lost, {
      version: PROTOCOL_VERSION,
      type: "tabs",
      tabs: [{ sessionId: "s1", title: "One", projectPath: "/p", projectName: "p", status: "idle" }],
      activeSessionId: "s1",
    });

    expect(back.error).toBeUndefined();
    expect(back.connection).toBe("open");
  });

  it("clears the connection error when only a catalogue arrives", () => {
    const lost = reduceAppMessage(initialAppState, { type: "connectionLost", error: "Waiting for the Pi Chat server…" });

    const back = reduceAppMessage(lost, { version: PROTOCOL_VERSION, type: "catalogue", catalogue: { projects: [] } });

    expect(back.error).toBeUndefined();
  });
});
