import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, type ServerMessage } from "../src/shared/protocol.js";
import { initialChatState, reduceServerMessage, type ChatState } from "../src/web/chat/chat-state.js";

describe("chat state", () => {
  it("replaces projected state with an authoritative snapshot", () => {
    const dirty = { ...initialChatState, messages: [{ id: "old", role: "user" as const, text: "old" }], sequence: 8 };
    const next = reduceServerMessage(dirty, {
      version: PROTOCOL_VERSION,
      type: "snapshot",
      sequence: 10,
      throughSequence: 10,
      sessionId: "session",
      projectPath: "/project",
      messages: [{ id: "saved", role: "assistant", text: "saved" }],
      isStreaming: false,
    });
    expect(next.messages.map((message) => message.id)).toEqual(["saved"]);
    expect(next.sequence).toBe(10);
  });

  it("assembles deltas and reconciles them with the final message", () => {
    const snapshot = reduceServerMessage(initialChatState, {
      version: PROTOCOL_VERSION, type: "snapshot", sequence: 0, throughSequence: 0,
      sessionId: "session", projectPath: "/project", messages: [], isStreaming: false,
    });
    const first = reduceServerMessage(snapshot, { version: PROTOCOL_VERSION, type: "assistantDelta", sessionId: "session", sequence: 1, runId: "run", delta: "Hello " });
    const second = reduceServerMessage(first, { version: PROTOCOL_VERSION, type: "assistantDelta", sessionId: "session", sequence: 2, runId: "run", delta: "world" });
    const final = reduceServerMessage(second, {
      version: PROTOCOL_VERSION, type: "messageFinal", sessionId: "session", sequence: 3, runId: "run",
      message: { id: "answer", role: "assistant", text: "Hello world" },
    });
    expect(second.draft?.text).toBe("Hello world");
    expect(final.draft).toBeUndefined();
    expect(final.messages).toEqual([{ id: "answer", role: "assistant", text: "Hello world" }]);
  });

  it("streams reasoning alongside the answer and hands it over to the final message", () => {
    const snapshot = reduceServerMessage(initialChatState, {
      version: PROTOCOL_VERSION, type: "snapshot", sequence: 0, throughSequence: 0,
      sessionId: "session", projectPath: "/project", messages: [], isStreaming: false,
    });
    const thought = reduceServerMessage(snapshot, { version: PROTOCOL_VERSION, type: "thinkingDelta", sessionId: "session", sequence: 1, runId: "run", delta: "Let me " });
    const thoughtMore = reduceServerMessage(thought, { version: PROTOCOL_VERSION, type: "thinkingDelta", sessionId: "session", sequence: 2, runId: "run", delta: "check." });
    // Prose arriving must not wipe the reasoning already on screen.
    const spoke = reduceServerMessage(thoughtMore, { version: PROTOCOL_VERSION, type: "assistantDelta", sessionId: "session", sequence: 3, runId: "run", delta: "Yes" });
    expect(spoke.draft).toEqual({ runId: "run", thinking: "Let me check.", text: "Yes" });

    const final = reduceServerMessage(spoke, {
      version: PROTOCOL_VERSION, type: "messageFinal", sessionId: "session", sequence: 4, runId: "run",
      message: { id: "answer", role: "assistant", text: "Yes", thinking: "Let me check." },
    });
    expect(final.draft).toBeUndefined();
    expect(final.messages).toEqual([{ id: "answer", role: "assistant", text: "Yes", thinking: "Let me check." }]);
  });

  it("starts a fresh draft when reasoning arrives for another run", () => {
    const first = reduceServerMessage(
      { ...initialChatState, sequence: 0, draft: { runId: "old", text: "stale", thinking: "stale" } },
      { version: PROTOCOL_VERSION, type: "thinkingDelta", sessionId: "session", sequence: 1, runId: "new", delta: "fresh" },
    );
    expect(first.draft).toEqual({ runId: "new", text: "", thinking: "fresh" });
  });

  it("keeps the transcript but drops the partial stream when the socket closes", () => {
    const streaming = {
      ...initialChatState,
      status: "running" as const,
      sequence: 3,
      messages: [{ id: "saved", role: "user" as const, text: "question" }],
      draft: { runId: "run", text: "half an ans", thinking: "" },
    };
    const lost = reduceServerMessage(streaming, { type: "connectionLost", error: "Waiting…" });
    expect(lost.status).toBe("connecting");
    expect(lost.draft).toBeUndefined();
    expect(lost.messages).toEqual(streaming.messages);
  });

  it("recovers from a reconnect even when the server restarted with lower sequences", () => {
    const lost = reduceServerMessage(
      { ...initialChatState, sequence: 42, status: "running" },
      { type: "connectionLost" },
    );
    const resumed = reduceServerMessage(lost, {
      version: PROTOCOL_VERSION, type: "snapshot", sequence: 0, throughSequence: 0,
      sessionId: "session", projectPath: "/project",
      messages: [{ id: "restored", role: "assistant", text: "restored" }], isStreaming: false,
    });
    expect(resumed.status).toBe("idle");
    expect(resumed.sequence).toBe(0);

    const next = reduceServerMessage(resumed, {
      version: PROTOCOL_VERSION, type: "runtimeStatus", sessionId: "session", sequence: 1, status: "running",
    });
    expect(next.status).toBe("running");
  });

  it("keeps a failed turn's reason visible once the run settles", () => {
    const running = { ...initialChatState, status: "running" as const, sequence: 1 };
    const settled = reduceServerMessage(running, {
      version: PROTOCOL_VERSION, type: "runtimeStatus", sessionId: "session", sequence: 2, status: "idle",
      error: "Codex error: The usage limit has been reached",
    });
    expect(settled.status).toBe("idle");
    expect(settled.error).toBe("Codex error: The usage limit has been reached");
  });

  it("transitions a tool card from running to success exactly once", () => {
    let state = { ...initialChatState, status: "running" as const, sequence: 0 };
    const running = reduceServerMessage(state, {
      version: PROTOCOL_VERSION, type: "toolEvent", sessionId: "session", sequence: 1, runId: "run",
      tool: { toolCallId: "call-1", name: "bash", status: "running", argsText: "{ }" },
    });
    expect(running.messages).toHaveLength(1);
    expect(running.messages[0]!.role).toBe("tool");
    if (running.messages[0]!.role === "tool") expect(running.messages[0]!.tool.status).toBe("running");

    // Streaming updates stay running and accumulate output without a new card.
    const updated = reduceServerMessage(running, {
      version: PROTOCOL_VERSION, type: "toolEvent", sessionId: "session", sequence: 2, runId: "run",
      tool: { toolCallId: "call-1", name: "bash", status: "running", outputText: "partial" },
    });
    expect(updated.messages).toHaveLength(1);
    if (updated.messages[0]!.role === "tool") {
      expect(updated.messages[0]!.tool.status).toBe("running");
      expect(updated.messages[0]!.tool.outputText).toBe("partial");
      expect(updated.messages[0]!.tool.argsText).toBe("{ }");
    }

    const finished = reduceServerMessage(updated, {
      version: PROTOCOL_VERSION, type: "toolEvent", sessionId: "session", sequence: 3, runId: "run",
      tool: { toolCallId: "call-1", name: "bash", status: "success", outputText: "done" },
    });
    expect(finished.messages).toHaveLength(1);
    if (finished.messages[0]!.role === "tool") {
      expect(finished.messages[0]!.tool.status).toBe("success");
      expect(finished.messages[0]!.tool.outputText).toBe("done");
    }

    // A duplicated final event must not re-run the transition or regress it.
    const replayed = reduceServerMessage(finished, {
      version: PROTOCOL_VERSION, type: "toolEvent", sessionId: "session", sequence: 4, runId: "run",
      tool: { toolCallId: "call-1", name: "bash", status: "running", outputText: "stale" },
    });
    expect(replayed.messages).toHaveLength(1);
    if (replayed.messages[0]!.role === "tool") {
      expect(replayed.messages[0]!.tool.status).toBe("success");
      expect(replayed.messages[0]!.tool.outputText).toBe("done");
    }
  });

  it("survives a missed tool start by creating the card at its final event", () => {
    // Happens when the client connected after the tool started: the snapshot
    // boundary swallowed tool_execution_start, but tool_execution_end is live.
    const state = { ...initialChatState, status: "running" as const, sequence: 5 };
    const next = reduceServerMessage(state, {
      version: PROTOCOL_VERSION, type: "toolEvent", sessionId: "session", sequence: 6, runId: "run",
      tool: { toolCallId: "call-9", name: "read", status: "error", outputText: "denied" },
    });
    expect(next.messages).toHaveLength(1);
    if (next.messages[0]!.role === "tool") expect(next.messages[0]!.tool.status).toBe("error");
  });

  it("ignores duplicate and stale sequenced events", () => {
    const state = { ...initialChatState, sequence: 4, status: "idle" as const };
    const next = reduceServerMessage(state, { version: PROTOCOL_VERSION, type: "runtimeStatus", sessionId: "session", sequence: 4, status: "running" });
    expect(next).toBe(state);
  });
});

describe("extension notifications", () => {
  it("appends notify output as a transcript notice", () => {
    const next = reduceServerMessage(initialChatState, {
      version: PROTOCOL_VERSION,
      type: "notification",
      sessionId: "session",
      sequence: 1,
      level: "warning",
      message: "Memory: pi-chat | Repo: Uncommitted changes",
    });

    expect(next.messages).toEqual([
      { id: "notice:1", role: "notice", level: "warning", text: "Memory: pi-chat | Repo: Uncommitted changes" },
    ]);
    expect(next.sequence).toBe(1);
  });
});

describe("ui prompts", () => {
  it("tracks pending prompts and restores them from a snapshot", () => {
    const prompt = { id: "p1", kind: "confirm" as const, title: "Allow?" };
    const opened = reduceServerMessage(initialChatState, {
      version: PROTOCOL_VERSION,
      type: "prompts",
      sessionId: "session",
      sequence: 1,
      prompts: [prompt],
    });
    expect(opened.prompts).toEqual([prompt]);

    const reconnected = reduceServerMessage(initialChatState, {
      version: PROTOCOL_VERSION,
      type: "snapshot",
      sequence: 5,
      throughSequence: 5,
      sessionId: "s1",
      projectPath: "/tmp",
      messages: [],
      isStreaming: false,
      prompts: [prompt],
    });
    expect(reconnected.prompts).toEqual([prompt]);

    const answered = reduceServerMessage(opened, {
      version: PROTOCOL_VERSION,
      type: "prompts",
      sessionId: "session",
      sequence: 2,
      prompts: [],
    });
    expect(answered.prompts).toEqual([]);
  });
});

describe("notices across snapshots", () => {
  it("keeps extension output when an authoritative snapshot arrives", () => {
    const withNotice = reduceServerMessage(initialChatState, {
      version: PROTOCOL_VERSION,
      type: "notification",
      sessionId: "session",
      sequence: 1,
      level: "info",
      message: "Model set to doppelclaude/claude-opus-5",
    });

    const next = reduceServerMessage(withNotice, {
      version: PROTOCOL_VERSION,
      type: "snapshot",
      sequence: 2,
      throughSequence: 2,
      sessionId: "s1",
      projectPath: "/tmp",
      messages: [{ id: "m1", role: "user", text: "hi" }],
      isStreaming: false,
    });

    expect(next.messages.map((entry) => entry.role)).toEqual(["user", "notice"]);
  });
});

describe("failed turns stay on screen", () => {
  const failed = reduceServerMessage(
    { ...initialChatState, sessionId: "s1", sequence: 0 },
    { version: PROTOCOL_VERSION, type: "runtimeStatus", sessionId: "s1", sequence: 1, status: "idle", error: "context limit reached" },
  );

  it("reports the failure when the turn settles", () => {
    expect(failed.error).toBe("context limit reached");
  });

  // The regression: `prompt` triggers a snapshot refresh, and a snapshot that
  // could not carry the failure replaced it with a clean state milliseconds
  // after the error appeared.
  it("survives the snapshot refresh that follows the run", () => {
    const refreshed = reduceServerMessage(failed, {
      version: PROTOCOL_VERSION,
      type: "snapshot",
      sequence: 2,
      throughSequence: 2,
      sessionId: "s1",
      projectPath: "/tmp",
      messages: [{ id: "m1", role: "user", text: "hi" }],
      isStreaming: false,
      lastError: "context limit reached",
    });
    expect(refreshed.error).toBe("context limit reached");
  });

  it("survives an unrelated status change", () => {
    const aborting = reduceServerMessage(failed, {
      version: PROTOCOL_VERSION, type: "runtimeStatus", sessionId: "s1", sequence: 2, status: "aborting",
    });
    expect(aborting.error).toBe("context limit reached");
  });

  it("clears once a new run starts", () => {
    const running = reduceServerMessage(failed, {
      version: PROTOCOL_VERSION, type: "runtimeStatus", sessionId: "s1", sequence: 2, status: "running",
    });
    expect(running.error).toBeUndefined();
  });

  it("clears when the server reports a clean settle", () => {
    const recovered = reduceServerMessage(failed, {
      version: PROTOCOL_VERSION,
      type: "snapshot",
      sequence: 2,
      throughSequence: 2,
      sessionId: "s1",
      projectPath: "/tmp",
      messages: [],
      isStreaming: false,
    });
    expect(recovered.error).toBeUndefined();
  });
});

describe("notices keep their place in the transcript", () => {
  const snapshotOf = (sequence: number, ids: string[]): Extract<ServerMessage, { type: "snapshot" }> => ({
    version: PROTOCOL_VERSION,
    type: "snapshot",
    sequence,
    throughSequence: sequence,
    sessionId: "s1",
    projectPath: "/tmp",
    messages: ids.map((id) => ({ id, role: id.startsWith("a") ? "assistant" : "user", text: id })),
    isStreaming: false,
  });

  // The reported bug: /session printed its notice, and after the next answer
  // the same notice reappeared at the bottom as if it had just been emitted.
  it("does not drag an earlier notice below a later answer", () => {
    let state = reduceServerMessage(initialChatState, snapshotOf(0, ["u1", "a1"]));
    state = reduceServerMessage(state, {
      version: PROTOCOL_VERSION, type: "notification", sessionId: "s1", sequence: 1, level: "info", message: "session stats",
    });
    expect(state.messages.map((entry) => entry.id)).toEqual(["u1", "a1", "notice:1"]);

    state = reduceServerMessage(state, snapshotOf(2, ["u1", "a1", "u2", "a2"]));

    expect(state.messages.map((entry) => entry.id)).toEqual(["u1", "a1", "notice:1", "u2", "a2"]);
  });

  it("keeps several notices in order at their own anchors", () => {
    let state = reduceServerMessage(initialChatState, snapshotOf(0, ["u1"]));
    state = reduceServerMessage(state, {
      version: PROTOCOL_VERSION, type: "notification", sessionId: "s1", sequence: 1, level: "info", message: "first",
    });
    state = reduceServerMessage(state, snapshotOf(2, ["u1", "a1"]));
    state = reduceServerMessage(state, {
      version: PROTOCOL_VERSION, type: "notification", sessionId: "s1", sequence: 3, level: "warning", message: "second",
    });
    state = reduceServerMessage(state, snapshotOf(4, ["u1", "a1", "u2"]));

    expect(state.messages.map((entry) => entry.id)).toEqual(["u1", "notice:1", "a1", "notice:3", "u2"]);
  });

  it("keeps a notice anchored past a shortened transcript at the end", () => {
    let state = reduceServerMessage(initialChatState, snapshotOf(0, ["u1", "a1"]));
    state = reduceServerMessage(state, {
      version: PROTOCOL_VERSION, type: "notification", sessionId: "s1", sequence: 1, level: "info", message: "compacted",
    });
    state = reduceServerMessage(state, snapshotOf(2, ["sum"]));

    expect(state.messages.map((entry) => entry.id)).toEqual(["sum", "notice:1"]);
  });
});

// A notice created before `anchor` existed, or before the session's first
// snapshot, used to fall back to the end of the list on every snapshot, so it
// kept resurfacing under each new answer. Its place is read from the transcript
// instead, and the resolved anchor is written back so it stays put.
describe("notices without a recorded anchor", () => {
  const snapshotOf = (sequence: number, ids: string[]): Extract<ServerMessage, { type: "snapshot" }> => ({
    version: PROTOCOL_VERSION,
    type: "snapshot",
    sequence,
    throughSequence: sequence,
    sessionId: "s1",
    projectPath: "/tmp",
    messages: ids.map((id) => ({ id, role: id.startsWith("a") ? "assistant" : "user", text: id })),
    isStreaming: false,
  });

  it("keeps an anchorless notice where it sits instead of at the bottom", () => {
    const stale: ChatState = {
      ...initialChatState,
      sessionId: "s1",
      sequence: 1,
      messages: [
        { id: "u1", role: "user", text: "hi" },
        { id: "a1", role: "assistant", text: "hello" },
        { id: "notice:1", role: "notice", level: "info", text: "session stats" },
      ],
    };

    const next = reduceServerMessage(stale, snapshotOf(2, ["u1", "a1", "u2", "a2"]));
    expect(next.messages.map((entry) => entry.id)).toEqual(["u1", "a1", "notice:1", "u2", "a2"]);
  });

  it("resolves the anchor once so later snapshots cannot move it", () => {
    const stale: ChatState = {
      ...initialChatState,
      sessionId: "s1",
      sequence: 1,
      messages: [
        { id: "u1", role: "user", text: "hi" },
        { id: "notice:1", role: "notice", level: "info", text: "session stats" },
      ],
    };

    const once = reduceServerMessage(stale, snapshotOf(2, ["u1", "a1"]));
    const twice = reduceServerMessage(once, snapshotOf(3, ["u1", "a1", "u2"]));
    expect(twice.messages.map((entry) => entry.id)).toEqual(["u1", "notice:1", "a1", "u2"]);
  });
});

describe("extension widgets", () => {
  const todo = { key: "todo", lines: ["── Todos ──", "○ #1 Write tests"], placement: "aboveEditor" as const };

  it("tracks pushed widgets and restores them from a snapshot", () => {
    const pushed = reduceServerMessage(initialChatState, {
      version: PROTOCOL_VERSION,
      type: "widgets",
      sessionId: "session",
      sequence: 1,
      widgets: [todo],
    });
    expect(pushed.widgets).toEqual([todo]);

    // A reconnecting browser rebuilds the panel from the snapshot alone.
    const reconnected = reduceServerMessage(initialChatState, {
      version: PROTOCOL_VERSION,
      type: "snapshot",
      sequence: 5,
      throughSequence: 5,
      sessionId: "session",
      projectPath: "/tmp",
      messages: [],
      isStreaming: false,
      widgets: [todo],
    });
    expect(reconnected.widgets).toEqual([todo]);

    const cleared = reduceServerMessage(pushed, {
      version: PROTOCOL_VERSION,
      type: "widgets",
      sessionId: "session",
      sequence: 2,
      widgets: [],
    });
    expect(cleared.widgets).toEqual([]);
  });

  /**
   * A snapshot is authoritative: an extension that stopped pushing a panel
   * must not leave it on screen forever.
   */
  it("drops widgets a snapshot no longer reports", () => {
    const pushed = reduceServerMessage(initialChatState, {
      version: PROTOCOL_VERSION, type: "widgets", sessionId: "session", sequence: 1, widgets: [todo],
    });

    const next = reduceServerMessage(pushed, {
      version: PROTOCOL_VERSION, type: "snapshot", sequence: 9, throughSequence: 9,
      sessionId: "session", projectPath: "/tmp", messages: [], isStreaming: false,
    });

    expect(next.widgets).toEqual([]);
  });
});

describe("extension statuses", () => {
  const readonly = { key: "readonly", text: "READONLY" };

  it("tracks pinned statuses and restores them from a snapshot", () => {
    const pinned = reduceServerMessage(initialChatState, {
      version: PROTOCOL_VERSION,
      type: "statuses",
      sessionId: "session",
      sequence: 1,
      statuses: [readonly],
    });
    expect(pinned.statuses).toEqual([readonly]);

    // A reconnecting browser rebuilds the footer label from the snapshot alone.
    const reconnected = reduceServerMessage(initialChatState, {
      version: PROTOCOL_VERSION,
      type: "snapshot",
      sequence: 5,
      throughSequence: 5,
      sessionId: "session",
      projectPath: "/tmp",
      messages: [],
      isStreaming: false,
      statuses: [readonly],
    });
    expect(reconnected.statuses).toEqual([readonly]);
  });

  /** A snapshot is authoritative: a cleared label must not linger on screen. */
  it("drops statuses a snapshot no longer reports", () => {
    const pinned = reduceServerMessage(initialChatState, {
      version: PROTOCOL_VERSION,
      type: "statuses",
      sessionId: "session",
      sequence: 1,
      statuses: [readonly],
    });

    const refreshed = reduceServerMessage(pinned, {
      version: PROTOCOL_VERSION,
      type: "snapshot",
      sequence: 2,
      throughSequence: 2,
      sessionId: "session",
      projectPath: "/tmp",
      messages: [],
      isStreaming: false,
    });

    expect(refreshed.statuses).toEqual([]);
  });
});
