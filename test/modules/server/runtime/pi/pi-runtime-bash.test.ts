import { describe, expect, it, vi } from "vitest";
import { PiRuntimeAdapter } from "../../../../../src/server/runtime/pi/pi-runtime-adapter.js";

type Session = Record<string, any>;
function runtime() {
  const messages: unknown[] = [];
  const session: Session = {
    sessionId: "s1", sessionFile: undefined, sessionName: undefined, messages,
    sessionManager: { getBranch: () => messages.map(message => ({ type: "message", message })) },
    isStreaming: false, isCompacting: false, isIdle: true, isBashRunning: false,
    model: undefined, thinkingLevel: "off", supportsThinking: () => false,
    getAvailableThinkingLevels: () => ["off"], promptTemplates: [],
    extensionRunner: { setUIContext: () => {}, getCommand: () => undefined, getRegisteredCommands: () => [], emitUserBash: vi.fn(async () => undefined) },
    prompt: vi.fn(async () => {}),
    recordBashResult: vi.fn((command: string, result: any, options: any) => messages.push({ role: "bashExecution", command, ...result, ...options })),
    executeBash: vi.fn(async (command: string, _onChunk: unknown, options: any) => {
      const result = { output: "hello\n", exitCode: 0, cancelled: false, truncated: false };
      session.recordBashResult(command, result, options);
      return result;
    }),
    abortBash: vi.fn(), abort: vi.fn(async () => {}), subscribe: () => () => {},
  };
  const adapter = new (PiRuntimeAdapter as any)({ session, cwd: "/tmp" }, []);
  return { adapter, session };
}

describe("native user bash", () => {
  it.each([["!printf hello", false], ["  !!printf hello  ", true]])("executes %s without a model call", async (input, excluded) => {
    const { adapter, session } = runtime();
    await adapter.prompt(input);
    expect(session.extensionRunner.emitUserBash).toHaveBeenCalledExactlyOnceWith({ type: "user_bash", command: "printf hello", excludeFromContext: excluded, cwd: "/tmp" });
    expect(session.executeBash).toHaveBeenCalledExactlyOnceWith("printf hello", undefined, { excludeFromContext: excluded, operations: undefined });
    expect(session.prompt).not.toHaveBeenCalled();
    expect(adapter.snapshot().messages).toMatchObject([{ role: "bash", bash: { output: "hello\n", excludeFromContext: excluded, status: "success" } }]);
  });

  it("preserves the shell body after the marker", async () => {
    const { adapter, session } = runtime();
    await adapter.prompt("!  printf 'a\\nb' | sort\nprintf done");
    expect(session.executeBash.mock.calls[0]?.[0]).toBe("  printf 'a\\nb' | sort\nprintf done");
  });

  it.each(["!", "!!", "!   "])("rejects empty %s", async input => {
    const { adapter, session } = runtime();
    await expect(adapter.prompt(input)).rejects.toThrow(/empty/i);
    expect(session.executeBash).not.toHaveBeenCalled();
  });

  it("leaves embedded exclamation marks as ordinary prompts", async () => {
    const { adapter, session } = runtime();
    await adapter.prompt("Hello! Run !pwd please");
    expect(session.prompt).toHaveBeenCalledExactlyOnceWith("Hello! Run !pwd please");
  });

  it("records extension-provided results without executing", async () => {
    const { adapter, session } = runtime();
    const result = { output: "remote\n", exitCode: 0, cancelled: false, truncated: false };
    session.extensionRunner.emitUserBash.mockResolvedValue({ result });
    await adapter.prompt("!!pwd");
    expect(session.executeBash).not.toHaveBeenCalled();
    expect(session.recordBashResult).toHaveBeenCalledExactlyOnceWith("pwd", result, { excludeFromContext: true });
  });

  it("cancels an active command through Pi", async () => {
    const { adapter, session } = runtime();
    let resolve!: (value: unknown) => void;
    session.executeBash.mockImplementation(() => new Promise(done => { resolve = done; }));
    const run = adapter.prompt("!sleep 10");
    await vi.waitFor(() => expect(session.executeBash).toHaveBeenCalled());
    await adapter.abort();
    expect(session.abortBash).toHaveBeenCalledOnce();
    resolve({ output: "", exitCode: undefined, cancelled: true, truncated: false });
    await run;
    expect(adapter.snapshot().isStreaming).toBe(false);
  });
});
