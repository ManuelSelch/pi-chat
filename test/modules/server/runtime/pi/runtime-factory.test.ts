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

it.each([false, true])("registers codemode and respects defaultTools enabled=%s", async enabled => {
  root = await mkdtemp(join(tmpdir(), "pi-chat-codemode-"));
  fixture.agentDir = join(root, "agent");
  const cwd = join(root, "workspace");
  await mkdir(fixture.agentDir);
  await mkdir(cwd);
  vi.stubEnv("PI_CHAT_MODEL", "");
  vi.stubEnv("PI_OFFLINE", "1");
  await writeFile(join(fixture.agentDir, "settings.json"), JSON.stringify({
    defaultTools: enabled ? ["+codemode"] : undefined,
    cacheWarming: "off",
  }));

  runtime = await createPiRuntime(cwd, SessionManager.inMemory(cwd));
  await runtime.session.bindExtensions({});
  expect(runtime.session.getAllTools().map(tool => tool.name)).toContain("codemode");
  expect(runtime.session.getActiveToolNames().includes("codemode")).toBe(enabled);
  expect(runtime.session.getActiveToolNames()).toEqual(expect.arrayContaining(["read", "bash", "edit", "write"]));
});
