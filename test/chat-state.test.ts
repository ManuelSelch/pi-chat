import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "../src/shared/protocol.js";
import { initialChatState, reduceServerMessage } from "../src/web/chat-state.js";

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
    const first = reduceServerMessage(snapshot, { version: PROTOCOL_VERSION, type: "assistantDelta", sequence: 1, runId: "run", delta: "Hello " });
    const second = reduceServerMessage(first, { version: PROTOCOL_VERSION, type: "assistantDelta", sequence: 2, runId: "run", delta: "world" });
    const final = reduceServerMessage(second, {
      version: PROTOCOL_VERSION, type: "messageFinal", sequence: 3, runId: "run",
      message: { id: "answer", role: "assistant", text: "Hello world" },
    });
    expect(second.draft?.text).toBe("Hello world");
    expect(final.draft).toBeUndefined();
    expect(final.messages).toEqual([{ id: "answer", role: "assistant", text: "Hello world" }]);
  });

  it("ignores duplicate and stale sequenced events", () => {
    const state = { ...initialChatState, sequence: 4, status: "idle" as const };
    const next = reduceServerMessage(state, { version: PROTOCOL_VERSION, type: "runtimeStatus", sequence: 4, status: "running" });
    expect(next).toBe(state);
  });
});
