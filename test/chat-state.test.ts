import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "../src/shared/protocol.js";
import { initialChatState, reduceServerMessage } from "../src/web/chat/chat-state.js";

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

  it("keeps the transcript but drops the partial stream when the socket closes", () => {
    const streaming = {
      ...initialChatState,
      status: "running" as const,
      sequence: 3,
      messages: [{ id: "saved", role: "user" as const, text: "question" }],
      draft: { runId: "run", text: "half an ans" },
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
