import { describe, expect, it } from "vitest";
import { PiRuntimeAdapter } from "../../../../../src/server/runtime/pi/pi-runtime-adapter.js";

function fakeAdapter(promptTemplates: unknown[], registeredCommands: unknown[] = [], skills: unknown[] = [], enableSkillCommands = true) {
  const session = {
    sessionId: "s1",
    sessionFile: undefined,
    sessionName: undefined,
    messages: [] as unknown[],
    isIdle: true,
    model: { provider: "p", id: "m" },
    thinkingLevel: "off",
    getAvailableThinkingLevels: () => ["off"],
    supportsThinking: () => false,
    promptTemplates,
    resourceLoader: { getSkills: () => ({ skills }) },
    settingsManager: { getEnableSkillCommands: () => enableSkillCommands },
    extensionRunner: {
      setUIContext: () => {},
      getCommand: (name: string) => registeredCommands.find((command) => (command as { invocationName: string }).invocationName === name),
      getRegisteredCommands: () => registeredCommands,
    },
    subscribe: () => () => {},
  };

  return new (PiRuntimeAdapter as unknown as new (runtime: unknown, models: string[]) => PiRuntimeAdapter)(
    { session, cwd: "/tmp" },
    [],
  );
}

describe("argument completion", () => {
  it("forwards the exact prefix to the exact invocation without executing it", async () => {
    let received = "";
    const adapter = fakeAdapter([], [{ invocationName: "deploy:2", getArgumentCompletions: async (prefix: string) => {
      received = prefix;
      return [{ value: "staging", label: "Staging", description: "Test environment" }];
    }, handler: () => { throw new Error("Must not execute"); } }]);
    expect(await adapter.completeCommandArguments("deploy:2", "one  st")).toEqual([
      { value: "staging", label: "Staging", description: "Test environment" },
    ]);
    expect(received).toBe("one  st");
    expect(await adapter.completeCommandArguments("deploy", "")).toEqual([]);
  });

  it("supports synchronous, null, missing and rejected providers", async () => {
    const adapter = fakeAdapter([], [
      { invocationName: "sync", getArgumentCompletions: () => [{ value: "a", label: "A" }] },
      { invocationName: "none", getArgumentCompletions: () => null },
      { invocationName: "missing" },
      { invocationName: "fail", getArgumentCompletions: () => Promise.reject(new Error("Unavailable")) },
    ]);
    expect(await adapter.completeCommandArguments("sync", "")).toEqual([{ value: "a", label: "A" }]);
    expect(await adapter.completeCommandArguments("none", "")).toEqual([]);
    expect(await adapter.completeCommandArguments("missing", "")).toEqual([]);
    await expect(adapter.completeCommandArguments("fail", "")).rejects.toThrow("Unavailable");
  });
});

describe("slash command catalogue", () => {
  it("includes loaded skills, including explicit-only skills, with descriptions and sorted names", () => {
    const adapter = fakeAdapter([], [], [
      { name: "zebra", description: "Explicit workflow", disableModelInvocation: true },
      { name: "alpha", description: "Automatic workflow", disableModelInvocation: false },
    ]);
    const commands = adapter.snapshot().actions.commands;
    expect(commands.filter(command => command.source === "skill")).toEqual([
      { name: "skill:alpha", description: "Automatic workflow", source: "skill" },
      { name: "skill:zebra", description: "Explicit workflow", source: "skill" },
    ]);
    expect(commands.map(command => command.name)).toEqual(commands.map(command => command.name).sort((a, b) => a.localeCompare(b)));
    expect(commands.some(command => command.name === "alpha")).toBe(false);
  });

  it("omits skill discovery when disabled or no skills are loaded", () => {
    expect(fakeAdapter([], [], [{ name: "alpha", description: "Workflow" }], false).snapshot().actions.commands
      .some(command => command.name === "skill:alpha")).toBe(false);
    expect(fakeAdapter([]).snapshot().actions.commands.some(command => command.source === "skill")).toBe(false);
  });

  it("keeps exact extension and template collisions without hiding distinct skill names", () => {
    const adapter = fakeAdapter(
      [{ name: "skill:template", description: "Template" }, { name: "distinct", description: "Bare template" }],
      [{ invocationName: "skill:extension", description: "Extension" }],
      ["extension", "template", "distinct"].map(name => ({ name, description: "Skill" })),
    );
    const commands = adapter.snapshot().actions.commands;
    expect(commands.filter(command => command.name === "skill:extension")).toEqual([
      { name: "skill:extension", description: "Extension", source: "extension" },
    ]);
    expect(commands.filter(command => command.name === "skill:template")).toEqual([
      { name: "skill:template", description: "Template", source: "prompt" },
    ]);
    expect(commands).toContainEqual({ name: "skill:distinct", description: "Skill", source: "skill" });
  });
  it("includes prompt templates with argument hints", () => {
    const adapter = fakeAdapter([
      {
        name: "review",
        description: "Review code",
        argumentHint: "<focus>",
        content: "Review $1",
        sourceInfo: { type: "global" },
        filePath: "/prompts/review.md",
      },
    ]);

    expect(adapter.snapshot().actions.commands).toContainEqual({
      name: "review",
      description: "Review code",
      argumentHint: "<focus>",
      source: "prompt",
    });
  });

  it("keeps native and extension commands ahead of conflicting prompt templates", () => {
    const adapter = fakeAdapter(
      [
        { name: "compact", description: "Template compact", content: "No", sourceInfo: {}, filePath: "compact.md" },
        { name: "custom", description: "Template custom", content: "No", sourceInfo: {}, filePath: "custom.md" },
      ],
      [{ invocationName: "custom", description: "Extension custom" }],
    );

    const commands = adapter.snapshot().actions.commands;
    expect(commands.find((command) => command.name === "compact")).toMatchObject({ source: "native" });
    expect(commands.find((command) => command.name === "custom")).toMatchObject({ description: "Extension custom", source: "extension" });
    expect(commands.filter((command) => command.name === "compact")).toHaveLength(1);
    expect(commands.filter((command) => command.name === "custom")).toHaveLength(1);
  });
});
