import { describe, expect, it } from "vitest";
import { PiRuntimeAdapter } from "../src/server/pi-runtime-adapter.js";

function fakeAdapter(promptTemplates: unknown[], registeredCommands: unknown[] = []) {
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
    resourceLoader: { getSkills: () => ({ skills: [] }) },
    extensionRunner: {
      setUIContext: () => {},
      getCommand: () => undefined,
      getRegisteredCommands: () => registeredCommands,
    },
    subscribe: () => () => {},
  };

  return new (PiRuntimeAdapter as unknown as new (runtime: unknown, models: string[]) => PiRuntimeAdapter)(
    { session, cwd: "/tmp" },
    [],
  );
}

describe("slash command catalogue", () => {
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
