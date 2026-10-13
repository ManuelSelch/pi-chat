import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  createAgentSessionFromServices, createAgentSessionRuntime, createAgentSessionServices,
  SessionManager, type AgentSession, type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { afterEach, expect, it } from "vitest";
import { PiRuntimeAdapter } from "../../../../../src/server/runtime/pi/pi-runtime-adapter.js";
import { textFromContent } from "../../../../../src/server/runtime/pi/message-mapping.js";
import type { RuntimeEvent } from "../../../../../src/server/runtime/contracts.js";

let root = "";
const adapters: PiRuntimeAdapter[] = [];
afterEach(async () => {
  for (const adapter of adapters.splice(0)) await adapter.dispose();
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

async function writeSkill(cwd: string, name: string, body = "Follow the fixture workflow.", explicitOnly = false) {
  const path = join(cwd, "skills", name, "SKILL.md");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `---\nname: ${name}\ndescription: ${name} workflow\ndisable-model-invocation: ${explicitOnly}\n---\n\n${body}\n`);
  return path;
}

// Real SDK preflight, expansion, events and persistence; only the model stream is stubbed.
async function stubModel(session: AgentSession) {
  const model = session.modelRuntime.getModel("anthropic", "claude-sonnet-4-5")!;
  await session.modelRuntime.setRuntimeApiKey("anthropic", "test-no-network");
  session.agent.state.model = model;
  session.agent.streamFunction = async () => {
    const message = {
      role: "assistant" as const, content: [{ type: "text" as const, text: "Fixture answer" }],
      api: model.api, provider: model.provider, model: model.id,
      usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop" as const, timestamp: Date.now(),
    };
    return {
      async *[Symbol.asyncIterator]() { yield { type: "done" as const, reason: "stop" as const, message }; },
      result: async () => message,
    } as unknown as Awaited<ReturnType<typeof session.agent.streamFunction>>;
  };
}

async function setup(options: { enabled?: boolean; extension?: (pi: ExtensionAPI) => void } = {}) {
  root = await realpath(await mkdtemp(join(tmpdir(), "pi-chat-skills-sdk-")));
  const cwd = join(root, "first");
  const agentDir = join(root, "agent");
  await mkdir(agentDir, { recursive: true });
  const settingsPath = join(agentDir, "settings.json");
  async function saveSettings(enabled: boolean) {
    await writeFile(settingsPath, JSON.stringify({ enableSkillCommands: enabled, compaction: { enabled: false }, cacheWarming: "off" }));
  }
  await saveSettings(options.enabled ?? true);
  const skillPath = await writeSkill(cwd, "fixture", undefined, true);
  const runtime = await createAgentSessionRuntime(async ({ cwd: targetCwd, sessionManager, sessionStartEvent }) => {
    const services = await createAgentSessionServices({
      cwd: targetCwd, agentDir,
      resourceLoaderOptions: {
        noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true,
        additionalSkillPaths: [join(targetCwd, "skills")],
        extensionFactories: options.extension ? [options.extension] : [],
      },
    });
    const result = await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent });
    await stubModel(result.session);
    return { ...result, services, diagnostics: services.diagnostics };
  }, { cwd, agentDir, sessionManager: SessionManager.inMemory(cwd) });
  await runtime.session.bindExtensions({});
  const adapter = PiRuntimeAdapter.fromRuntime(runtime);
  adapters.push(adapter);
  return { adapter, runtime, cwd, skillPath, saveSettings };
}

function skillCommands(adapter: PiRuntimeAdapter) {
  return adapter.snapshot().actions.commands.filter(command => command.source === "skill");
}

function userTexts(adapter: PiRuntimeAdapter) {
  return adapter.snapshot().messages.flatMap(message => message.role === "user" ? [message.text] : []);
}

it.each(["", " Prepare today's report"])("expands a real skill with task suffix %j and keeps live/snapshot identity", async suffix => {
  const { adapter, runtime, skillPath } = await setup();
  expect(skillCommands(adapter)).toEqual([{ name: "skill:fixture", description: "fixture workflow", source: "skill" }]);
  const users: RuntimeEvent[] = [];
  adapter.subscribe(event => {
    if (event.type === "messageFinal" && event.message.role === "user") {
      users.push(event);
      expect(adapter.snapshot().messages).toContainEqual(event.message);
    }
  });
  await adapter.prompt(`/skill:fixture${suffix}`);
  const user = runtime.session.messages.flatMap(message => message.role === "user" ? [textFromContent(message.content)] : []);
  expect(adapter.snapshot().messages.find(message => message.role === "user")).toMatchObject({
    text: suffix.trim(), skill: { name: "fixture", location: skillPath, content: expect.stringContaining("Follow the fixture workflow.") },
  });
  expect(users).toHaveLength(1);
  expect(user).toHaveLength(1);
  expect(user[0]).toBe(`<skill name="fixture" location="${skillPath}">\nReferences are relative to ${dirname(skillPath)}.\n\nFollow the fixture workflow.\n</skill>${suffix ? `\n\n${suffix.trim()}` : ""}`);
  expect(user[0]).not.toContain("disable-model-invocation");
});

it("keeps manually typed skill invocation working when discovery is disabled", async () => {
  const { adapter } = await setup({ enabled: false });
  expect(skillCommands(adapter)).toEqual([]);
  await adapter.prompt("/skill:fixture manual request");
  expect(userTexts(adapter)[0]).toBe("manual request");
  expect(adapter.snapshot().messages[0]).toMatchObject({ skill: { name: "fixture" } });
  expect(await adapter.completeCommandArguments("skill:fixture", "")).toEqual([]);
});

it("lets input hooks see and transform the raw command before skill expansion", async () => {
  const received: string[] = [];
  const { adapter } = await setup({ extension: pi => {
    pi.on("input", event => {
      received.push(event.text);
      return { action: "transform", text: "/skill:fixture transformed task" };
    });
  } });
  await adapter.prompt("/skill:fixture original task");
  expect(received).toEqual(["/skill:fixture original task"]);
  expect(userTexts(adapter)[0]).toBe("transformed task");
  expect(adapter.snapshot().messages[0]).toMatchObject({ skill: { name: "fixture" } });
});

it("gives exact extension commands precedence and retains their argument provider", async () => {
  const received: string[] = [];
  const { adapter } = await setup({ extension: pi => {
    pi.on("input", () => { throw new Error("Extension commands must bypass input hooks"); });
    pi.registerCommand("skill:fixture", {
      description: "Extension workflow",
      getArgumentCompletions: prefix => [{ value: `${prefix}done`, label: "Done" }],
      handler: async args => { received.push(args); },
    });
  } });
  expect(skillCommands(adapter)).toEqual([]);
  expect(adapter.snapshot().actions.commands.filter(command => command.name === "skill:fixture")).toEqual([
    { name: "skill:fixture", description: "Extension workflow", source: "extension" },
  ]);
  await adapter.prompt("/skill:fixture extension task");
  expect(received).toEqual(["extension task"]);
  expect(adapter.snapshot().messages).toEqual([]);
  expect(await adapter.completeCommandArguments("skill:fixture", "a")).toEqual([{ value: "adone", label: "Done" }]);
});

it("preserves unknown-name and missing-file SDK fallback behavior", async () => {
  const { adapter, runtime, skillPath } = await setup();
  const errors: { event: string; extensionPath: string }[] = [];
  runtime.session.extensionRunner.onError(error => { errors.push(error); });
  await adapter.prompt("/skill:unknown task");
  expect(errors).toEqual([]);
  await rm(skillPath);
  await adapter.prompt("/skill:fixture missing file");
  expect(errors).toMatchObject([{ event: "skill_expansion", extensionPath: skillPath }]);
  expect(userTexts(adapter))
    .toEqual(["/skill:unknown task", "/skill:fixture missing file"]);
});

it("reads edited instructions on invocation and refreshes skills/settings on reload", async () => {
  const { adapter, runtime, cwd, saveSettings } = await setup();
  await writeSkill(cwd, "fixture", "Edited instructions.");
  await adapter.prompt("/skill:fixture");
  expect(adapter.snapshot().messages[0]).toMatchObject({ skill: { content: expect.stringContaining("Edited instructions.") } });
  await rm(join(cwd, "skills", "fixture"), { recursive: true });
  await writeSkill(cwd, "replacement");
  const sessionId = runtime.session.sessionId;
  await adapter.reload();
  expect(runtime.session.sessionId).toBe(sessionId);
  expect(skillCommands(adapter).map(command => command.name)).toEqual(["skill:replacement"]);
  await saveSettings(false);
  await adapter.reload();
  expect(skillCommands(adapter)).toEqual([]);
  await saveSettings(true);
  await adapter.reload();
  expect(skillCommands(adapter).map(command => command.name)).toEqual(["skill:replacement"]);
});

it("uses replacement-session workspace resources without caching the previous catalogue", async () => {
  const { adapter, runtime } = await setup();
  const nextCwd = join(root, "second");
  await writeSkill(nextCwd, "second");
  const nextManager = SessionManager.create(nextCwd, join(root, "sessions"));
  // Pi defers empty-session persistence; materialize a valid header for opening.
  await writeFile(nextManager.getSessionFile()!, `${JSON.stringify(nextManager.getHeader())}\n`);
  const events: RuntimeEvent[] = [];
  adapter.subscribe(event => events.push(event));
  await runtime.switchSession(nextManager.getSessionFile()!);
  expect(events.some(event => event.type === "sessionSwitch")).toBe(true);
  expect(adapter.snapshot().projectPath).toBe(nextCwd);
  expect(skillCommands(adapter).map(command => command.name)).toEqual(["skill:second"]);
  await adapter.prompt("/skill:second new workspace");
  expect(userTexts(adapter)[0]).toBe("new workspace");
  expect(adapter.snapshot().messages[0]).toMatchObject({ skill: { name: "second" } });
});
