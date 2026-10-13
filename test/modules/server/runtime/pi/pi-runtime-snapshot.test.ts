import { describe, expect, it, vi } from "vitest";
import { PiRuntimeAdapter } from "../../../../../src/server/runtime/pi/pi-runtime-adapter.js";
import type { RuntimeEvent } from "../../../../../src/server/runtime/contracts.js";

function runtime() {
  let dispatch: (event: any) => void = () => {};
  const branch: unknown[] = [];
  const session = {
    sessionId: "s1", messages: [] as unknown[],
    sessionManager: { getBranch: vi.fn(() => branch) },
    isStreaming: false, isIdle: true, isCompacting: false,
    model: undefined, thinkingLevel: "off", supportsThinking: () => false,
    getAvailableThinkingLevels: () => ["off"], promptTemplates: [],
    settingsManager: { getEnableSkillCommands: () => false },
    extensionRunner: { setUIContext: () => {}, getCommand: () => undefined, getRegisteredCommands: () => [] },
    subscribe: (handler: typeof dispatch) => { dispatch = handler; return () => {}; },
  };
  const adapter = new (PiRuntimeAdapter as unknown as new (runtime: unknown) => PiRuntimeAdapter)({ session, cwd: "/tmp" });
  return { adapter, session, branch, emit: (event: any) => dispatch(event) };
}

describe("SDK-owned transcript snapshots", () => {
  it("includes a finalized user message before branch persistence with the same live id", () => {
    const { adapter, session, branch, emit } = runtime();
    const user = { role: "user", content: "New message", timestamp: 1 };
    const events: RuntimeEvent[] = [];
    adapter.subscribe(event => events.push(event));
    // Agent core updates messages before notifying the public listeners.
    session.messages.push(user);
    emit({ type: "message_end", message: user });
    const live = events.find(event => event.type === "messageFinal");
    expect(live?.type === "messageFinal" && live.message).toEqual(adapter.snapshot().messages[0]);
    expect(adapter.snapshot().messages).toHaveLength(1);
    branch.push({ type: "message", message: user });
    expect(adapter.snapshot().messages).toHaveLength(1);
    expect(session.sessionManager.getBranch).not.toHaveBeenCalled();
  });

  it("uses only the compacted SDK context, not old branch messages", () => {
    const { adapter, session, branch } = runtime();
    branch.push({ type: "message", message: { role: "user", content: "Summarized original" } });
    session.messages = [
      { role: "compactionSummary", summary: "Earlier work summarized", tokensBefore: 1000, timestamp: 1 },
      { role: "user", content: "Retained message", timestamp: 2 },
    ];
    expect(adapter.snapshot().messages).toMatchObject([
      { role: "custom", customType: "compaction-summary", text: "Earlier work summarized" },
      { role: "user", text: "Retained message" },
    ]);
    expect(session.sessionManager.getBranch).not.toHaveBeenCalled();
  });

  it("renders SDK custom messages and bash results in SDK order", () => {
    const { adapter, session } = runtime();
    session.messages = [
      { role: "custom", customType: "memory", content: "Memory context", display: true },
      { role: "custom", customType: "internal", content: "Hidden", display: false },
      { role: "bashExecution", command: "pwd", output: "/tmp", exitCode: 0, cancelled: false, truncated: false },
    ];
    expect(adapter.snapshot().messages).toMatchObject([
      { role: "custom", customType: "memory", text: "Memory context" },
      { role: "bash", bash: { command: "pwd", output: "/tmp" } },
    ]);
  });

  it("refreshes the transcript after successful automatic compaction", () => {
    const { adapter, session, emit } = runtime();
    const listener = vi.fn();
    adapter.subscribe(listener);
    session.messages = [{ role: "compactionSummary", summary: "Compacted", tokensBefore: 1000 }];
    emit({ type: "compaction_end", reason: "threshold", result: { summary: "Compacted", tokensBefore: 1000 }, aborted: false, willRetry: true });
    expect(listener).toHaveBeenCalledWith({ type: "sessionMetadataChanged" });
  });

  it.each([
    { result: undefined, aborted: true },
    { result: undefined, aborted: false, errorMessage: "Failed" },
  ])("does not refresh the transcript for unsuccessful compaction", result => {
    const { adapter, emit } = runtime();
    const listener = vi.fn();
    adapter.subscribe(listener);
    emit({ type: "compaction_end", reason: "threshold", willRetry: false, ...result });
    expect(listener).not.toHaveBeenCalledWith({ type: "sessionMetadataChanged" });
  });
});
