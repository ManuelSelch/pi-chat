import { describe, expect, it, vi } from "vitest";
import { PiRuntimeAdapter } from "../src/server/runtime/pi/pi-runtime-adapter.js";

function fixture() {
  let savedPatterns = ["p/old"];
  let patterns = savedPatterns;
  const catalogue = ["old", "new"].map((id) => ({ provider: "p", id }));
  const session = {
    sessionId: "s1", messages: [], isIdle: true,
    model: catalogue[0], thinkingLevel: "off", promptTemplates: [],
    getAvailableThinkingLevels: () => ["off"], supportsThinking: () => false,
    subscribe: () => () => {},
    prompt: vi.fn(async (_message: string) => {}),
    modelRuntime: {
      getAvailable: async () => catalogue,
      getAvailableSnapshot: () => catalogue,
    },
    settingsManager: { reload: vi.fn(async () => { patterns = savedPatterns; }), getEnabledModels: () => patterns },
    extensionRunner: {
      setUIContext: () => {}, getCommand: () => undefined,
      getRegisteredCommands: () => [], emit: vi.fn(async () => {}),
    },
  };
  let rebind!: () => Promise<void>;
  const runtime = {
    session, cwd: "/tmp",
    setRebindSession: (handler: typeof rebind) => { rebind = handler; },
  };
  const adapter = new (PiRuntimeAdapter as unknown as new (runtime: unknown, models: string[]) => PiRuntimeAdapter)(runtime, ["p/old"]);
  return { adapter, session, runtime, rebind: () => rebind(), setPatterns: (value: string[]) => { savedPatterns = value; } };
}

const options = (adapter: PiRuntimeAdapter) => adapter.snapshot().actions.features.find((f) => f.id === "model.select")!.state.options;

describe("model picker refresh", () => {
  it("updates cached model options after an extension command saves defaults", async () => {
    const { adapter, session, setPatterns } = fixture();
    session.prompt.mockImplementation(async () => { setPatterns(["p/new"]); });
    await adapter.prompt("/defaults");
    expect(options(adapter)).toEqual(["p/new"]);
    expect(session.model?.id).toBe("old");
  });

  it("refreshes the native picker before showing it", async () => {
    const { adapter, setPatterns } = fixture();
    setPatterns(["p/new"]);
    const shown = new Promise<void>((resolve) => {
      adapter.subscribe((event) => {
        if (event.type !== "prompts" || !event.prompts.length) return;
        expect(event.prompts[0]!.options).toEqual(["p/new"]);
        adapter.respondToPrompt(event.prompts[0]!.id, { cancelled: true });
        resolve();
      });
    });
    await Promise.all([adapter.prompt("/model"), shown]);
  });

  it("refreshes after rebinding and session_start changes settings", async () => {
    const { adapter, session, runtime, rebind, setPatterns } = fixture();
    runtime.session = { ...session, sessionId: "s2" };
    session.extensionRunner.emit.mockImplementation(async () => { setPatterns(["p/new"]); });
    await rebind();
    expect(options(adapter)).toEqual(["p/new"]);
  });
});
