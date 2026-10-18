import { snapshotEvent, coreEvent, presentationEvent } from "../../../../infra/v2-fixtures.js";
import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, type ServerMessage } from "../../../../../src/shared/protocol.js";
import { initialChatState, reduceServerMessage, type ChatState } from "../../../../infra/pi-chat/browser-session-view.js";

describe("chat state", () => {
  it("restores steering on reconnect and accepts only fresh queue updates", () => {
    const restored = reduceServerMessage(initialChatState, snapshotEvent({ throughSequence: 5, sessionId: "session", projectPath: "/project", messages: [], steeringMessages: ["Native queued text"], runtime: { status: "running" } }));
    expect(restored.steeringMessages).toEqual(["Native queued text"]);
    const consumed = reduceServerMessage(restored, coreEvent("steering.queue.changed", { messages: [] }, "session", 6));
    expect(consumed.steeringMessages).toEqual([]);
    expect(reduceServerMessage(consumed, coreEvent("steering.queue.changed", { messages: ["Stale"] }, "session", 5))).toBe(consumed);
  });

  it("drops unfinished draft on a fresh authoritative snapshot", () => {
    const state = { ...initialChatState, sessionId: "session", status: "running" as const, draft: { runId: "run", text: "Partial answer", thinking: "Reasoning" } };
    const next = reduceServerMessage(state, snapshotEvent({ throughSequence: 5, sessionId: "session", projectPath: "/project", messages: [], steeringMessages: ["Change direction"], runtime: { status: "running" } }));
    expect(next.draft).toBeUndefined();
  });
  it("replaces projected state with an authoritative snapshot", () => {
    const dirty = { ...initialChatState, messages: [{ id: "old", role: "user" as const, text: "old" }], sequence: 8 };
    const next = reduceServerMessage(dirty, snapshotEvent({ throughSequence: 10, sessionId: "session", projectPath: "/project", messages: [{ id: "saved", role: "assistant", text: "saved" }], runtime: { status: "idle" } }));
    expect(next.messages.map((message) => message.id)).toEqual(["saved"]);
    expect(next.sequence).toBe(10);
  });

  it("assembles deltas and reconciles them with the final message", () => {
    const snapshot = reduceServerMessage(initialChatState, snapshotEvent({ throughSequence: 0, sessionId: "session", projectPath: "/project", messages: [], runtime: { status: "idle" } }));
    const first = reduceServerMessage(snapshot, coreEvent("message.delta", { runId: "run", delta: "Hello " }, "session", 1));
    const second = reduceServerMessage(first, coreEvent("message.delta", { runId: "run", delta: "world" }, "session", 2));
    const final = reduceServerMessage(second, coreEvent("message.finalized", { runId: "run", message: { id: "answer", role: "assistant", text: "Hello world" } }, "session", 3));
    expect(second.draft?.text).toBe("Hello world");
    expect(final.draft).toBeUndefined();
    expect(final.messages).toEqual([{ id: "answer", role: "assistant", text: "Hello world" }]);
  });

  it("streams reasoning alongside the answer and hands it over to the final message", () => {
    const snapshot = reduceServerMessage(initialChatState, snapshotEvent({ throughSequence: 0, sessionId: "session", projectPath: "/project", messages: [], runtime: { status: "idle" } }));
    const thought = reduceServerMessage(snapshot, coreEvent("message.thinking.delta", { runId: "run", delta: "Let me " }, "session", 1));
    const thoughtMore = reduceServerMessage(thought, coreEvent("message.thinking.delta", { runId: "run", delta: "check." }, "session", 2));
    // Prose arriving must not wipe the reasoning already on screen.
    const spoke = reduceServerMessage(thoughtMore, coreEvent("message.delta", { runId: "run", delta: "Yes" }, "session", 3));
    expect(spoke.draft).toEqual({ runId: "run", thinking: "Let me check.", text: "Yes" });

    const final = reduceServerMessage(spoke, coreEvent("message.finalized", { runId: "run", message: { id: "answer", role: "assistant", text: "Yes", thinking: "Let me check." } }, "session", 4));
    expect(final.draft).toBeUndefined();
    expect(final.messages).toEqual([{ id: "answer", role: "assistant", text: "Yes", thinking: "Let me check." }]);
  });

  it("starts a fresh draft when reasoning arrives for another run", () => {
    const first = reduceServerMessage(
      { ...initialChatState, sequence: 0, draft: { runId: "old", text: "stale", thinking: "stale" } },
      coreEvent("message.thinking.delta", { runId: "new", delta: "fresh" }, "session", 1),
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
    const resumed = reduceServerMessage(lost, snapshotEvent({ throughSequence: 0, sessionId: "session", projectPath: "/project", messages: [{ id: "restored", role: "assistant", text: "restored" }], runtime: { status: "idle" } }));
    expect(resumed.status).toBe("idle");
    expect(resumed.sequence).toBe(0);

    const next = reduceServerMessage(resumed, coreEvent("runtime.status", { status: "running" }, "session", 1));
    expect(next.status).toBe("running");
  });

  it("keeps a failed turn's reason visible once the run settles", () => {
    const running = { ...initialChatState, status: "running" as const, sequence: 1 };
    const settled = reduceServerMessage(running, coreEvent("runtime.status", { status: "idle", lastError: "Codex error: The usage limit has been reached" }, "session", 2));
    expect(settled.status).toBe("idle");
    expect(settled.error).toBe("Codex error: The usage limit has been reached");
  });

  it("transitions a tool card from running to success exactly once", () => {
    let state = { ...initialChatState, status: "running" as const, sequence: 0 };
    const running = reduceServerMessage(state, coreEvent("tool.updated", { runId: "run", tool: { toolCallId: "call-1", name: "bash", status: "running", argsText: "{ }" } }, "session", 1));
    expect(running.messages).toHaveLength(1);
    expect(running.messages[0]!.role).toBe("tool");
    if (running.messages[0]!.role === "tool") expect(running.messages[0]!.tool.status).toBe("running");

    // Streaming updates stay running and accumulate output without a new card.
    const updated = reduceServerMessage(running, coreEvent("tool.updated", { runId: "run", tool: { toolCallId: "call-1", name: "bash", status: "running", outputText: "partial" } }, "session", 2));
    expect(updated.messages).toHaveLength(1);
    if (updated.messages[0]!.role === "tool") {
      expect(updated.messages[0]!.tool.status).toBe("running");
      expect(updated.messages[0]!.tool.outputText).toBe("partial");
      expect(updated.messages[0]!.tool.argsText).toBe("{ }");
    }

    const finished = reduceServerMessage(updated, coreEvent("tool.updated", { runId: "run", tool: { toolCallId: "call-1", name: "bash", status: "success", outputText: "done" } }, "session", 3));
    expect(finished.messages).toHaveLength(1);
    if (finished.messages[0]!.role === "tool") {
      expect(finished.messages[0]!.tool.status).toBe("success");
      expect(finished.messages[0]!.tool.outputText).toBe("done");
    }

    // A duplicated final event must not re-run the transition or regress it.
    const replayed = reduceServerMessage(finished, coreEvent("tool.updated", { runId: "run", tool: { toolCallId: "call-1", name: "bash", status: "running", outputText: "stale" } }, "session", 4));
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
    const next = reduceServerMessage(state, coreEvent("tool.updated", { runId: "run", tool: { toolCallId: "call-9", name: "read", status: "error", outputText: "denied" } }, "session", 6));
    expect(next.messages).toHaveLength(1);
    if (next.messages[0]!.role === "tool") expect(next.messages[0]!.tool.status).toBe("error");
  });

  it("ignores duplicate and stale sequenced events", () => {
    const state = { ...initialChatState, sequence: 4, status: "idle" as const };
    const next = reduceServerMessage(state, coreEvent("runtime.status", { status: "running" }, "session", 4));
    expect(next).toBe(state);
  });
});

describe("extension notifications", () => {
  it("appends notify output as a transcript notice", () => {
    const next = reduceServerMessage(initialChatState, coreEvent("notification.created", { level: "warning", message: "Memory: pi-chat | Repo: Uncommitted changes" }, "session", 1));

    expect(next.messages).toEqual([
      { id: "notice:1", role: "notice", level: "warning", text: "Memory: pi-chat | Repo: Uncommitted changes" },
    ]);
    expect(next.sequence).toBe(1);
  });
});

describe("ui prompts", () => {
  it("tracks pending prompts and restores them from a snapshot", () => {
    const prompt = { id: "p1", kind: "confirm" as const, title: "Allow?", message: "Run?" };
    const opened = reduceServerMessage(initialChatState, coreEvent("prompt.list.changed", { prompts: [prompt] }, "session", 1));
    expect(opened.prompts).toEqual([prompt]);

    const reconnected = reduceServerMessage(initialChatState, snapshotEvent({ throughSequence: 5, sessionId: "s1", projectPath: "/tmp", messages: [], prompts: [prompt], runtime: { status: "idle" } }));
    expect(reconnected.prompts).toEqual([prompt]);

    const answered = reduceServerMessage(opened, coreEvent("prompt.list.changed", { prompts: [] }, "session", 2));
    expect(answered.prompts).toEqual([]);
  });
});

describe("notices across snapshots", () => {
  it("keeps extension output when an authoritative snapshot arrives", () => {
    const withNotice = reduceServerMessage(initialChatState, coreEvent("notification.created", { level: "info", message: "Model set to doppelclaude/claude-opus-5" }, "session", 1));

    const next = reduceServerMessage(withNotice, snapshotEvent({ throughSequence: 2, sessionId: "s1", projectPath: "/tmp", messages: [{ id: "m1", role: "user", text: "hi" }], runtime: { status: "idle" } }));

    expect(next.messages.map((entry) => entry.role)).toEqual(["user", "notice"]);
  });
});

describe("failed turns stay on screen", () => {
  const failed = reduceServerMessage(
    { ...initialChatState, sessionId: "s1", sequence: 0 },
    coreEvent("runtime.status", { status: "idle", lastError: "context limit reached" }, "s1", 1),
  );

  it("reports the failure when the turn settles", () => {
    expect(failed.error).toBe("context limit reached");
  });

  // The regression: `prompt` triggers a snapshot refresh, and a snapshot that
  // could not carry the failure replaced it with a clean state milliseconds
  // after the error appeared.
  it("survives the snapshot refresh that follows the run", () => {
    const refreshed = reduceServerMessage(failed, snapshotEvent({ throughSequence: 2, sessionId: "s1", projectPath: "/tmp", messages: [{ id: "m1", role: "user", text: "hi" }], runtime: { status: "idle", lastError: "context limit reached" } }));
    expect(refreshed.error).toBe("context limit reached");
  });

  it("survives an unrelated status change", () => {
    const aborting = reduceServerMessage(failed, coreEvent("runtime.status", { status: "aborting" }, "s1", 2));
    expect(aborting.error).toBe("context limit reached");
  });

  it("clears once a new run starts", () => {
    const running = reduceServerMessage(failed, coreEvent("runtime.status", { status: "running" }, "s1", 2));
    expect(running.error).toBeUndefined();
  });

  it("clears when the server reports a clean settle", () => {
    const recovered = reduceServerMessage(failed, snapshotEvent({ throughSequence: 2, sessionId: "s1", projectPath: "/tmp", messages: [], runtime: { status: "idle" } }));
    expect(recovered.error).toBeUndefined();
  });
});

describe("notices keep their place in the transcript", () => {
  const snapshotOf = (sequence: number, ids: string[]): ReturnType<typeof snapshotEvent> => (snapshotEvent({ throughSequence: sequence, sessionId: "s1", projectPath: "/tmp", messages: ids.map((id) => ({ id, role: id.startsWith("a") ? "assistant" : "user", text: id })), runtime: { status: "idle" } }));

  // The reported bug: /session printed its notice, and after the next answer
  // the same notice reappeared at the bottom as if it had just been emitted.
  it("does not drag an earlier notice below a later answer", () => {
    let state = reduceServerMessage(initialChatState, snapshotOf(0, ["u1", "a1"]));
    state = reduceServerMessage(state, coreEvent("notification.created", { level: "info", message: "session stats" }, "s1", 1));
    expect(state.messages.map((entry) => entry.id)).toEqual(["u1", "a1", "notice:1"]);

    state = reduceServerMessage(state, snapshotOf(2, ["u1", "a1", "u2", "a2"]));

    expect(state.messages.map((entry) => entry.id)).toEqual(["u1", "a1", "notice:1", "u2", "a2"]);
  });

  it("keeps several notices in order at their own anchors", () => {
    let state = reduceServerMessage(initialChatState, snapshotOf(0, ["u1"]));
    state = reduceServerMessage(state, coreEvent("notification.created", { level: "info", message: "first" }, "s1", 1));
    state = reduceServerMessage(state, snapshotOf(2, ["u1", "a1"]));
    state = reduceServerMessage(state, coreEvent("notification.created", { level: "warning", message: "second" }, "s1", 3));
    state = reduceServerMessage(state, snapshotOf(4, ["u1", "a1", "u2"]));

    expect(state.messages.map((entry) => entry.id)).toEqual(["u1", "notice:1", "a1", "notice:3", "u2"]);
  });

  it("keeps a notice anchored past a shortened transcript at the end", () => {
    let state = reduceServerMessage(initialChatState, snapshotOf(0, ["u1", "a1"]));
    state = reduceServerMessage(state, coreEvent("notification.created", { level: "info", message: "compacted" }, "s1", 1));
    state = reduceServerMessage(state, snapshotOf(2, ["sum"]));

    expect(state.messages.map((entry) => entry.id)).toEqual(["sum", "notice:1"]);
  });
});

// A notice created before `anchor` existed, or before the session's first
// snapshot, used to fall back to the end of the list on every snapshot, so it
// kept resurfacing under each new answer. Its place is read from the transcript
// instead, and the resolved anchor is written back so it stays put.
describe("notices without a recorded anchor", () => {
  const snapshotOf = (sequence: number, ids: string[]): ReturnType<typeof snapshotEvent> => (snapshotEvent({ throughSequence: sequence, sessionId: "s1", projectPath: "/tmp", messages: ids.map((id) => ({ id, role: id.startsWith("a") ? "assistant" : "user", text: id })), runtime: { status: "idle" } }));

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
    const pushed = reduceServerMessage(initialChatState, presentationEvent({ widgets: [todo] }, "session", 1));
    expect(pushed.widgets).toEqual([todo]);

    // A reconnecting browser rebuilds the panel from the snapshot alone.
    const reconnected = reduceServerMessage(initialChatState, snapshotEvent({ throughSequence: 5, sessionId: "session", projectPath: "/tmp", messages: [], runtime: { status: "idle" }, presentation: { revision: 5, widgets: [todo], footer: [], extensions: { buttons: [], badges: [], state: {} } } }));
    expect(reconnected.widgets).toEqual([todo]);

    const cleared = reduceServerMessage(pushed, presentationEvent({ widgets: [] }, "session", 2));
    expect(cleared.widgets).toEqual([]);
  });

  /**
   * A snapshot is authoritative: an extension that stopped pushing a panel
   * must not leave it on screen forever.
   */
  it("drops widgets a snapshot no longer reports", () => {
    const pushed = reduceServerMessage(initialChatState, presentationEvent({ widgets: [todo] }, "session", 1));

    const next = reduceServerMessage(pushed, snapshotEvent({ throughSequence: 9, sessionId: "session", projectPath: "/tmp", messages: [], runtime: { status: "idle" } }));

    expect(next.widgets).toEqual([]);
  });
});

describe("composer footer", () => {
  const readonly = { key: "status.readonly", text: "READONLY", align: "left" as const, variant: "badge" as const };
  const model = { key: "model", text: "doppelclaude/claude-opus-5", align: "right" as const, variant: "plain" as const };

  it("tracks a pushed footer and restores it from a snapshot", () => {
    const pushed = reduceServerMessage(initialChatState, presentationEvent({ footer: [readonly, model] }, "session", 1));
    expect(pushed.footer).toEqual([readonly, model]);

    // A reconnecting browser rebuilds the footer from the snapshot alone.
    const reconnected = reduceServerMessage(initialChatState, snapshotEvent({ throughSequence: 5, sessionId: "session", projectPath: "/tmp", messages: [], runtime: { status: "idle" }, presentation: { revision: 5, widgets: [], footer: [readonly, model], extensions: { buttons: [], badges: [], state: {} } } }));
    expect(reconnected.footer).toEqual([readonly, model]);
  });

  /** A snapshot is authoritative: a cleared label must not linger on screen. */
  it("drops footer entries a snapshot no longer reports", () => {
    const pushed = reduceServerMessage(initialChatState, presentationEvent({ footer: [readonly, model] }, "session", 1));

    const refreshed = reduceServerMessage(pushed, snapshotEvent({ throughSequence: 2, sessionId: "session", projectPath: "/tmp", messages: [], runtime: { status: "idle" } }));

    expect(refreshed.footer).toEqual([]);
  });
});
