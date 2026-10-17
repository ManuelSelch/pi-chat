import { describe, expect, it, vi } from "vitest";
import { PiRuntimeAdapter } from "../../../../../src/server/runtime/pi/pi-runtime-adapter.js";

function runtime() {
  let handler: (event: any) => void = () => {};
  let queue: string[] = [];
  const session = {
    sessionId: "s1", messages: [] as unknown[], sessionManager: { getBranch: () => [] },
    isStreaming: false, isIdle: true, isCompacting: false, isBashRunning: false,
    model: undefined, thinkingLevel: "off", supportsThinking: () => false,
    getAvailableThinkingLevels: () => ["off"], promptTemplates: [],
    settingsManager: { getEnableSkillCommands: () => false },
    getSteeringMessages: () => queue,
    extensionRunner: { setUIContext: () => {}, getCommand: () => undefined, getRegisteredCommands: () => [] },
    prompt: vi.fn(async (_text: string, _options?: unknown) => {}),
    subscribe: (callback: typeof handler) => { handler = callback; return () => {}; },
  };
  const adapter = new (PiRuntimeAdapter as any)({ session, cwd: "/tmp" }, []) as PiRuntimeAdapter;
  return {
    adapter, session,
    queue: (messages: string[]) => { queue = messages; handler({ type: "queue_update", steering: messages, followUp: [] }); },
    consume: (message: { role: "user"; content: string; timestamp: number }) => {
      handler({ type: "message_start", message });
      session.messages.push(message); // SDK state is updated before message_end.
      handler({ type: "message_end", message });
    },
  };
}

describe("native steering", () => {
  it("uses Pi's streaming behavior for idle and running prompts", async () => {
    const { adapter, session } = runtime();
    await adapter.prompt("Start");
    session.isStreaming = true;
    session.isIdle = false;
    await adapter.prompt("Change direction");
    expect(session.prompt.mock.calls).toEqual([
      ["Start", { streamingBehavior: "steer" }],
      ["Change direction", { streamingBehavior: "steer" }],
    ]);
  });

  it("projects native queue updates and reconnect snapshots, including consumption", () => {
    const { adapter, queue } = runtime();
    const listener = vi.fn();
    adapter.subscribe(listener);
    queue(["Use the existing API"]);
    expect(listener).toHaveBeenLastCalledWith({ type: "steeringQueue", messages: ["Use the existing API"] });
    expect(adapter.snapshot().steeringMessages).toEqual(["Use the existing API"]);
    queue([]);
    expect(listener).toHaveBeenLastCalledWith({ type: "steeringQueue", messages: [] });
    expect(adapter.snapshot().steeringMessages).toEqual([]);
  });

  it("only publishes queue state while steering is pending", () => {
    const { adapter, queue } = runtime();
    const listener = vi.fn();
    adapter.subscribe(listener);
    queue(["Use the existing API", "Prefer the shared helper"]);

    expect(listener.mock.calls).toEqual([[{
      type: "steeringQueue", messages: ["Use the existing API", "Prefer the shared helper"],
    }]]);
    expect(adapter.snapshot().messages).toEqual([]);
  });

  it("keeps identical queued texts distinct and publishes each actual consumed message once", () => {
    const { adapter, queue, consume } = runtime();
    const listener = vi.fn();
    adapter.subscribe(listener);
    queue(["Same direction", "Same direction"]);
    expect(listener.mock.calls).toEqual([[{ type: "steeringQueue", messages: ["Same direction", "Same direction"] }]]);
    expect(adapter.snapshot().steeringMessages).toEqual(["Same direction", "Same direction"]);
    expect(adapter.snapshot().messages).toEqual([]);

    queue(["Same direction"]);
    consume({ role: "user", content: "Same direction", timestamp: 1 });
    expect(adapter.snapshot().steeringMessages).toEqual(["Same direction"]);
    queue([]);
    consume({ role: "user", content: "Same direction", timestamp: 1 });
    const finalMessages = listener.mock.calls.flatMap(([event]) => event.type === "messageFinal" ? [event.message] : []);
    expect(finalMessages).toHaveLength(2);
    expect(finalMessages[0].id).not.toBe(finalMessages[1].id);
    expect(finalMessages.every(message => message.role === "user" && message.text === "Same direction")).toBe(true);
    expect(adapter.snapshot().messages).toEqual(finalMessages);
    expect(adapter.snapshot().steeringMessages).toEqual([]);
  });

  it.each(["Steer", "/extension-command"])("keeps the original preflight claim after %s returns", async input => {
    const { adapter, session } = runtime();
    vi.spyOn(adapter as any, "refreshModels").mockResolvedValue(undefined);
    let finish!: () => void;
    session.prompt.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const run = adapter.prompt("Start");
    await vi.waitFor(() => expect(session.prompt).toHaveBeenCalledOnce());
    session.isStreaming = true;
    session.isIdle = false;
    await adapter.prompt(input);
    session.isStreaming = false;
    session.isIdle = true;
    await expect(adapter.prompt("Too early")).rejects.toThrow(/current run/i);
    finish();
    await run;
    await adapter.prompt("Next run");
  });

  it.each(["/extension-command", "/skill:review", "/template"])("delegates %s to Pi while streaming", async input => {
    const { adapter, session } = runtime();
    vi.spyOn(adapter as any, "refreshModels").mockResolvedValue(undefined);
    session.isStreaming = true;
    session.isIdle = false;
    await adapter.prompt(input);
    expect(session.prompt).toHaveBeenCalledExactlyOnceWith(input, { streamingBehavior: "steer" });
    expect(adapter.snapshot().isStreaming).toBe(true);
  });

  it("allows native /session while streaming without submitting model input", async () => {
    const { adapter, session } = runtime();
    Object.assign(session, { getSessionStats: () => ({
      sessionId: "s1", totalMessages: 0, userMessages: 0, assistantMessages: 0, toolCalls: 0, toolResults: 0,
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }, cost: 0,
    }) });
    session.isStreaming = true;
    session.isIdle = false;
    await adapter.prompt("/session");
    expect(session.prompt).not.toHaveBeenCalled();
  });

  it.each(["command", "action"])("delegates compact %s to Pi during an active prompt", async invocation => {
    const { adapter, session } = runtime();
    let finish!: () => void;
    session.prompt.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const run = adapter.prompt("Start");
    await vi.waitFor(() => expect(session.prompt).toHaveBeenCalledOnce());
    session.isStreaming = true;
    session.isIdle = false;
    const compact = vi.fn(async () => {
      session.isStreaming = false;
      session.isIdle = true;
      finish();
      return { tokensBefore: 100 };
    });
    Object.assign(session, { compact });
    if (invocation === "command") await adapter.prompt("/compact");
    else await adapter.compact();
    await run;
    expect(compact).toHaveBeenCalledOnce();
    expect(adapter.snapshot().isStreaming).toBe(false);
  });

  it("delegates reload to Pi while streaming", async () => {
    const { adapter, session } = runtime();
    const reload = vi.fn(async () => {});
    Object.assign(session, { reload });
    vi.spyOn(adapter as any, "refreshModels").mockResolvedValue(undefined);
    session.isStreaming = true;
    session.isIdle = false;
    await adapter.reload();
    expect(reload).toHaveBeenCalledOnce();
  });

  it.each(["!pwd", "!!pwd"])("rejects busy bash %s instead of steering it", async input => {
    const { adapter, session } = runtime();
    session.isStreaming = true;
    session.isIdle = false;
    await expect(adapter.prompt(input)).rejects.toThrow(/current run/i);
    expect(session.prompt).not.toHaveBeenCalled();
  });

  it.each(["isCompacting", "isBashRunning"] as const)("does not steer during %s", async flag => {
    const { adapter, session } = runtime();
    session[flag] = true;
    await expect(adapter.prompt("New direction")).rejects.toThrow(/current run/i);
    expect(session.prompt).not.toHaveBeenCalled();
  });
});
