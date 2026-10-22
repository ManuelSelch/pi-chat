import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager, type AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { afterEach, expect, it, vi } from "vitest";
import { createPiRuntime } from "../../../../../src/server/runtime/pi/runtime-factory.js";

const fixture = vi.hoisted(() => ({ agentDir: "" }));
vi.mock("@earendil-works/pi-coding-agent", async importOriginal => ({
  ...await importOriginal<typeof import("@earendil-works/pi-coding-agent")>(),
  getAgentDir: () => fixture.agentDir,
}));

let root = "";
let runtime: AgentSessionRuntime | undefined;
afterEach(async () => {
  runtime?.session.dispose();
  runtime = undefined;
  vi.unstubAllEnvs();
  if (root) await rm(root, { recursive: true, force: true });
});

it.each([false, true])("registers runtime extensions and respects defaultTools enabled=%s", async enabled => {
  root = await mkdtemp(join(tmpdir(), "pi-chat-codemode-"));
  fixture.agentDir = join(root, "agent");
  const cwd = join(root, "workspace");
  await mkdir(fixture.agentDir);
  await mkdir(cwd);
  vi.stubEnv("PI_CHAT_MODEL", "");
  vi.stubEnv("PI_OFFLINE", "1");
  await writeFile(join(fixture.agentDir, "settings.json"), JSON.stringify({
    defaultTools: enabled ? ["+codemode", "+tool_search"] : undefined,
    cacheWarming: "off",
  }));

  runtime = await createPiRuntime(cwd, SessionManager.inMemory(cwd));
  await runtime.session.bindExtensions({});
  const tools = runtime.session.getAllTools().map(tool => tool.name);
  for (const name of ["codemode", "tool_search"]) {
    expect(tools).toContain(name);
    expect(runtime.session.getActiveToolNames().includes(name)).toBe(enabled);
  }
  const extensions = runtime.session.resourceLoader.getExtensions().extensions;
  expect(extensions.some(extension => extension.commands.has("mcp"))).toBe(true);
  expect(runtime.session.getActiveToolNames()).toEqual(expect.arrayContaining(["read", "bash", "edit", "write"]));
});
