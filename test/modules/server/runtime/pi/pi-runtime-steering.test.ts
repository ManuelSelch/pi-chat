import { describe, expect, it, vi } from "vitest";
import { PiRuntimeAdapter } from "../../../../../src/server/runtime/pi/pi-runtime-adapter.js";

function runtime() {
  let handler: (event: any) => void = () => {};
  let queue: string[] = [];
  const session = {
    sessionId: "s1", messages: [], sessionManager: { getBranch: () => [] },
    isStreaming: false, isIdle: true, isCompacting: false, isBashRunning: false,
    model: undefined, thinkingLevel: "off", supportsThinking: () => false,
    getAvailableThinkingLevels: () => ["off"], promptTemplates: [],
    getSteeringMessages: () => queue,
    extensionRunner: { setUIContext: () => {}, getCommand: () => undefined, getRegisteredCommands: () => [] },
    prompt: vi.fn(async (_text: string, _options?: unknown) => {}),
    subscribe: (callback: typeof handler) => { handler = callback; return () => {}; },
  };
  const adapter = new (PiRuntimeAdapter as any)({ session, cwd: "/tmp" }, []) as PiRuntimeAdapter;
  return { adapter, session, queue: (messages: string[]) => { queue = messages; handler({ type: "queue_update", steering: messages, followUp: [] }); } };
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

  it("does not release the initial prompt's preflight claim when steering returns", async () => {
    const { adapter, session } = runtime();
    let finish!: () => void;
    session.prompt.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const run = adapter.prompt("Start");
    await vi.waitFor(() => expect(session.prompt).toHaveBeenCalledOnce());
    session.isStreaming = true;
    session.isIdle = false;
    await adapter.prompt("Steer");
    session.isStreaming = false;
    session.isIdle = true;
    await expect(adapter.prompt("Too early")).rejects.toThrow(/current run/i);
    finish();
    await run;
    await adapter.prompt("Next run");
  });

  it.each(["!pwd", "/new", "/reload"])("rejects busy command %s instead of steering it", async input => {
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
