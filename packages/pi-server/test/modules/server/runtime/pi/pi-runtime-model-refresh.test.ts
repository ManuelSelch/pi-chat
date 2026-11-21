import { describe, expect, it, vi } from "vitest";
import { PiRuntimeAdapter } from "../../../../../src/runtime/pi/pi-runtime-adapter.js";

function fixture() {
  let savedPatterns = ["p/old"];
  let patterns = savedPatterns;
  const catalogue = ["old", "new"].map((id) => ({ provider: "p", id }));
  const session = {
    sessionId: "s1", messages: [], isIdle: true,
    model: catalogue[0], thinkingLevel: "off", promptTemplates: [],
    setModel: vi.fn(async (_model: unknown) => {}),
    getAvailableThinkingLevels: () => ["off"], supportsThinking: () => false,
    subscribe: () => () => {},
    prompt: vi.fn(async (_message: string) => {}),
    bindExtensions: async () => { await session.extensionRunner.emit(); },
    modelRuntime: {
      getAvailable: async () => catalogue,
      getAvailableSnapshot: () => catalogue,
    },
    resourceLoader: { getThemes: () => ({ themes: [] }) },
    settingsManager: { getThemeSetting: () => "dark", getEnableSkillCommands: () => false, reload: vi.fn(async () => { patterns = savedPatterns; }), getEnabledModels: () => patterns },
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
        expect(event.prompts[0]!.options).toEqual(["p/new", "p/old"]);
        expect(event.prompts[0]!.modelScope).toEqual({ scoped: ["p/new"] });
        adapter.respondToPrompt(event.prompts[0]!.id, { cancelled: true });
        resolve();
      });
    });
    await Promise.all([adapter.prompt("/model"), shown]);
  });

  it("allows selecting an available model outside the configured scope without changing settings", async () => {
    const { adapter, session } = fixture();
    adapter.subscribe(event => {
      if (event.type !== "prompts" || !event.prompts.length) return;
      adapter.respondToPrompt(event.prompts[0]!.id, { cancelled: false, value: "p/new" });
    });

    await adapter.prompt("/model");

    expect(session.setModel).toHaveBeenCalledWith({ provider: "p", id: "new" });
    expect(session.settingsManager.getEnabledModels()).toEqual(["p/old"]);
    expect(options(adapter)).toEqual(["p/old"]);
  });

  it("resolves a new theme before extension startup when the runtime is replaced", async () => {
    const { adapter, session, runtime, rebind } = fixture();
    const previousTheme = adapter.uiContext().theme;
    const previousPalette = adapter.sessionTheme();
    runtime.session = { ...session, sessionId: "s2", settingsManager: { ...session.settingsManager, getThemeSetting: () => "light" } };
    session.extensionRunner.emit.mockImplementation(async () => {
      expect(adapter.sessionTheme().appearance).toBe("light");
      expect(adapter.uiContext().theme.appearance).toBe("light");
    });
    await rebind();
    expect(adapter.uiContext().theme).not.toBe(previousTheme);
    expect(adapter.sessionTheme()).not.toBe(previousPalette);
    expect(previousPalette.name).toBe("dark");
    expect(previousTheme.appearance).toBe("dark");
  });

  it("refreshes after rebinding and session_start changes settings", async () => {
    const { adapter, session, runtime, rebind, setPatterns } = fixture();
    runtime.session = { ...session, sessionId: "s2" };
    session.extensionRunner.emit.mockImplementation(async () => { setPatterns(["p/new"]); });
    await rebind();
    expect(options(adapter)).toEqual(["p/new"]);
  });
});
