import { describe, expect, it } from "vitest";
import { MessageIdentity, messagesFromBranch, toChatMessages } from "../../../../../src/server/runtime/pi/message-mapping.js";
import { chatMessageSchema } from "../../../../../src/shared/protocol.js";

const result = { role: "bashExecution", command: "printf hello", output: "hello\n", exitCode: 0, cancelled: false, truncated: false };

describe("bash history", () => {
  it.each([
    [{}, "success"], [{ output: "" }, "success"], [{ exitCode: 3 }, "error"],
    [{ cancelled: true, exitCode: undefined }, "cancelled"],
  ])("projects a persisted bash result %j", (overrides, status) => {
    const [message] = toChatMessages({ ...result, ...overrides }, new MessageIdentity());
    expect(message).toMatchObject({ role: "bash", bash: { command: result.command, status, excludeFromContext: false } });
    expect(chatMessageSchema.parse(message)).toEqual(message);
  });
  it("bounds and strips terminal escapes while preserving truncation and exclusion", () => {
    const [message] = toChatMessages({ ...result, output: `\x1b[31m${"x".repeat(30000)}\x1b[0m`, truncated: true, fullOutputPath: "/tmp/output", excludeFromContext: true }, new MessageIdentity());
    expect(message).toMatchObject({ bash: { truncated: true, fullOutputPath: "/tmp/output", excludeFromContext: true } });
    if (message?.role !== "bash") throw new Error("expected bash");
    expect(message.bash.output.length).toBeLessThanOrEqual(20000);
    expect(message.bash.output).not.toContain("\x1b");
  });
  it("keeps identical executions separate and snapshot identity stable", () => {
    const identity = new MessageIdentity();
    const first = { ...result }, second = { ...result };
    const branch = [{ type: "message", message: first }, { type: "message", message: second }];
    const messages = messagesFromBranch(branch, identity);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.id).not.toBe(messages[1]?.id);
    expect(messagesFromBranch(branch, identity)).toEqual(messages);
  });
});
