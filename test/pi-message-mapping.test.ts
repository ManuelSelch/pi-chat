import { describe, expect, it } from "vitest";
import { MessageIdentity, mergeEntriesById, sessionStatsMarkdown, toChatMessage, toChatMessages } from "../src/server/pi-runtime-adapter.js";

describe("Pi message mapping", () => {
  it("gives one message the same id live and in a later snapshot", () => {
    const identity = new MessageIdentity();
    const message = { role: "assistant", content: [{ type: "text", text: "Hello" }], timestamp: 1 };

    const live = toChatMessage(message, identity);
    const snapshot = [{ role: "user", content: "Hi", timestamp: 0 }, message]
      .map((item) => toChatMessage(item, identity))
      .filter((item) => item !== undefined);

    expect(live?.id).toBe(snapshot[1]?.id);
    expect(new Set(snapshot.map((item) => item?.id)).size).toBe(2);
  });

  it("joins text parts and ignores non-text content", () => {
    const identity = new MessageIdentity();
    const message = {
      role: "assistant",
      content: [{ type: "text", text: "Hello " }, { type: "toolCall", id: "1" }, { type: "text", text: "world" }],
    };
    const text = toChatMessage(message, identity);
    expect(text?.role).toBe("assistant");
    if (text?.role === "assistant") expect(text.text).toBe("Hello world");
  });

  it("turns a tool-call-only assistant message into running tool entries, not an empty bubble", () => {
    const identity = new MessageIdentity();
    const message = {
      role: "assistant",
      content: [{ type: "toolCall", id: "call-1", name: "bash", arguments: { command: "ls" } }],
    };
    const entries = toChatMessages(message, identity);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "tool:call-1",
      role: "tool",
      tool: { toolCallId: "call-1", name: "bash", status: "running" },
    });
    expect(entries[0]!.role === "tool" && entries[0]!.tool.argsText).toContain('"ls"');
  });

  it("maps a toolResult to a finalized tool entry with the same deterministic id", () => {
    const identity = new MessageIdentity();
    const entries = toChatMessages(
      { role: "toolResult", toolCallId: "call-1", toolName: "bash", content: [{ type: "text", text: "out" }], isError: false },
      identity,
    );
    expect(entries).toEqual([
      { id: "tool:call-1", role: "tool", tool: { toolCallId: "call-1", name: "bash", status: "success", outputText: "out" } },
    ]);

    const failed = toChatMessages(
      { role: "toolResult", toolCallId: "call-1", toolName: "bash", content: [{ type: "text", text: "boom" }], isError: true },
      identity,
    );
    expect(failed[0]!.role === "tool" && failed[0]!.tool.status).toBe("error");
  });

  it("flattens a session with running-then-final tool entries that the snapshot dedupes by id", () => {
    const identity = new MessageIdentity();
    const session = [
      { role: "assistant", content: [{ type: "toolCall", id: "call-1", name: "read", arguments: {} }] },
      { role: "toolResult", toolCallId: "call-1", toolName: "read", content: [{ type: "text", text: "file body" }] },
    ];
    const entries = session.flatMap((message) => toChatMessages(message, identity));
    expect(entries.map((entry) => entry.id)).toEqual(["tool:call-1", "tool:call-1"]);
    const merged = mergeEntriesById(entries);
    expect(merged).toHaveLength(1);
    const card = merged[0]!;
    expect(card.role === "tool" && card.tool.status).toBe("success");
    expect(card.role === "tool" && card.tool.outputText).toBe("file body");
  });

  it("snapshot merge keeps arguments from the call and output from the result", () => {
    const identity = new MessageIdentity();
    const session = [
      { role: "assistant", content: [{ type: "toolCall", id: "call-1", name: "read", arguments: { path: "/tmp/x" } }] },
      { role: "toolResult", toolCallId: "call-1", toolName: "read", content: [{ type: "text", text: "file body" }] },
    ];
    const entries = session.flatMap((message) => toChatMessages(message, identity));
    const merged = mergeEntriesById(entries).find((entry) => entry.id === "tool:call-1")!;
    if (merged.role !== "tool") throw new Error("expected tool entry");
    expect(merged.tool.status).toBe("success");
    expect(merged.tool.outputText).toBe("file body");
    expect(merged.tool.argsText).toContain("/tmp/x");
  });

  it("drops an assistant message with neither text nor tool calls", () => {
    const identity = new MessageIdentity();
    expect(toChatMessages({ role: "assistant", content: [] }, identity)).toEqual([]);
    expect(toChatMessages({ role: "toolResult", content: [] }, identity)).toEqual([]);
    expect(toChatMessages(undefined, identity)).toEqual([]);
  });
});

describe("session stats", () => {
  const base = {
    sessionId: "abc",
    sessionFile: "/tmp/s.jsonl",
    totalMessages: 10,
    userMessages: 4,
    assistantMessages: 6,
    toolCalls: 3,
    toolResults: 3,
    tokens: { input: 1000, output: 200, cacheRead: 0, cacheWrite: 0, total: 1200 },
    cost: 0,
  };

  it("reports context window use when the model has reported it", () => {
    const text = sessionStatsMarkdown({ ...base, contextUsage: { tokens: 25_000, contextWindow: 200_000, percent: 12.5 } });
    expect(text).toContain("Used: 25,000 of 200,000 (12.5%)");
  });

  it("omits context, cache, and cost sections that have nothing to say", () => {
    const text = sessionStatsMarkdown(base);
    expect(text).not.toContain("**Context**");
    expect(text).not.toContain("Cached:");
    expect(text).not.toContain("**Cost**");
  });

  it("splits cached from uncached input and names the session and model", () => {
    const text = sessionStatsMarkdown(
      { ...base, tokens: { input: 1000, output: 200, cacheRead: 3000, cacheWrite: 1000, total: 5200 }, cost: 0.1234 },
      "My session",
      "anthropic/claude-opus-5",
    );
    expect(text).toContain("Input: 5,000");
    expect(text).toContain("Cached: 3,000 (60.0%)");
    expect(text).toContain("Uncached: 2,000");
    expect(text).toContain("Name: My session");
    expect(text).toContain("Model: anthropic/claude-opus-5");
    expect(text).toContain("Total: $0.123");
  });
});
