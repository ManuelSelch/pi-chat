import { describe, expect, it } from "vitest";
import { PiRuntimeAdapter } from "../../../../../src/runtime/pi/pi-runtime-adapter.js";
import type { RuntimeEvent } from "../../../../../src/runtime/contracts.js";

function failingRuntime(failure: unknown) {
  const session = {
    isIdle: true, isStreaming: false, isCompacting: false, isBashRunning: false,
    getAvailableThinkingLevels: () => ["off"], supportsThinking: () => false,
    resourceLoader: { getThemes: () => ({ themes: [] }), getSkills: () => ({ skills: [] }) },
    settingsManager: { getThemeSetting: () => "dark", getEnableSkillCommands: () => true },
    extensionRunner: { setUIContext: () => {}, getCommand: () => undefined, getRegisteredCommands: () => [] },
    subscribe: () => () => {},
    prompt: async () => { throw failure; },
  };
  const adapter = new (PiRuntimeAdapter as unknown as new (runtime: unknown, models: string[]) => PiRuntimeAdapter)({ session, cwd: "/tmp" }, []);
  const events: RuntimeEvent[] = [];
  adapter.subscribe(event => events.push(event));
  return { adapter, events };
}

describe("prompt setup failures", () => {
  it("notifies the session and preserves the rejected operation", async () => {
    const runtime = failingRuntime(new Error("Invalid system prompt section name: agenticFlow"));

    await expect(runtime.adapter.prompt("Hello")).rejects.toThrow("Invalid system prompt section name: agenticFlow");

    expect(runtime.events.filter(event => event.type === "notification")).toEqual([
      { type: "notification", level: "error", message: "Invalid system prompt section name: agenticFlow" },
    ]);
  });

  it("uses a fallback for non-Error failures", async () => {
    const runtime = failingRuntime(null);

    await expect(runtime.adapter.prompt("Hello")).rejects.toBeNull();

    expect(runtime.events.filter(event => event.type === "notification")).toEqual([
      { type: "notification", level: "error", message: "Command failed." },
    ]);
  });
});
