import { describe, expect, it } from "vitest";
import { clampToolOutput, toolCallsFromContent, toolCardFromCall, toolMessageId } from "../../../../../src/server/runtime/pi/tool-mapping.js";
import { MessageIdentity, toChatMessages } from "../../../../../src/server/runtime/pi/message-mapping.js";

describe("tool mapping", () => {
  it("ignores malformed blocks and defaults unnamed tools", () => {
    expect(toolCallsFromContent(undefined)).toEqual([]);
    expect(toolCallsFromContent([null, "text", {}, { type: "toolCall", id: "" },
      { type: "toolCall", id: "a" }, { type: "toolCall", id: "b", name: "bash", arguments: { command: "ls" } },
    ])).toEqual([
      { id: "a", name: "tool", arguments: undefined },
      { id: "b", name: "bash", arguments: { command: "ls" } },
    ]);
    expect(toolMessageId("a")).toBe("tool:a");
  });

  it("omits absent arguments and tolerates circular arguments", () => {
    expect(toolCardFromCall({ id: "a", name: "bash" })).not.toHaveProperty("argsText");
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(toolCardFromCall({ id: "a", name: "bash", arguments: circular }).argsText).toBe("[object Object]");
  });

  it("keeps the same output limit for live tools and historical results", () => {
    const output = "x".repeat(20_001);
    expect(clampToolOutput("x".repeat(20_000))).toBe("x".repeat(20_000));
    expect(clampToolOutput(output)).toBe(`${"x".repeat(20_000)}… [truncated]`);
    const [result] = toChatMessages({ role: "toolResult", toolCallId: "a", toolName: "bash", content: ` ${output} ` }, new MessageIdentity());
    expect(result).toMatchObject({ id: toolMessageId("a"), tool: { outputText: clampToolOutput(output) } });
  });
});
