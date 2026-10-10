import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager, type AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { expect, it, vi } from "vitest";
import { PiRuntimeAdapter } from "../../../../../src/server/runtime/pi/pi-runtime-adapter.js";

it("uses Pi reload to refresh extension imports and browser bindings without replacing the session", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-chat-reload-"));
  let adapter: PiRuntimeAdapter | undefined;
  try {
    const path = join(dir, "extension.ts");
    const helper = join(dir, "helper.ts");
    await writeFile(path, 'export { default } from "./implementation.ts";');
    await writeFile(join(dir, "implementation.ts"), `import { description } from "./helper.ts";
export default pi => {
  pi.on("session_start", (event, ctx) => {
    ctx.ui.setWidget("reload-widget", [description]);
    ctx.ui.notify(event.reason + ":" + description, "info");
  });
  pi.on("session_shutdown", (event, ctx) => ctx.ui.notify("shutdown:" + event.reason, "info"));
  pi.registerCommand("cache-test", { description, handler: async (_, ctx) => ctx.ui.notify(description, "info") });
  pi.registerCommand("extension-reload", { handler: async (_, ctx) => { await ctx.reload(); } });
}`);
    await writeFile(helper, 'export const description = "before";');
    const settingsManager = SettingsManager.inMemory();
    const resourceLoader = new DefaultResourceLoader({
      cwd: dir, agentDir: dir, settingsManager,
      additionalExtensionPaths: [path], noSkills: true, noPromptTemplates: true, noThemes: true,
    });
    await resourceLoader.reload();
    const { session } = await createAgentSession({ cwd: dir, agentDir: dir, settingsManager, resourceLoader, sessionManager: SessionManager.inMemory(dir) });
    adapter = PiRuntimeAdapter.fromRuntime({ session, cwd: dir, dispose: async () => session.dispose() } as AgentSessionRuntime);
    const notices: string[] = [];
    adapter.subscribe(event => { if (event.type === "notification") notices.push(event.message); });
    await (adapter as unknown as { startExtensions(): Promise<void> }).startExtensions();
    session.sessionManager.appendMessage({ role: "user", content: "keep this conversation", timestamp: Date.now() });
    const before = adapter.snapshot();
    const reload = vi.spyOn(session, "reload");
    const dispose = vi.spyOn(session, "dispose");
    await writeFile(helper, 'export const description = "after";');

    await adapter.reload();

    expect(reload).toHaveBeenCalledOnce();
    expect(dispose).not.toHaveBeenCalled();
    expect(adapter.snapshot().sessionId).toBe(before.sessionId);
    expect(adapter.snapshot().messages).toEqual(before.messages);
    expect(adapter.snapshot().actions.commands.find(c => c.name === "cache-test")?.description).toBe("after");
    expect(notices).toContain("shutdown:reload");
    expect(notices.filter(n => n === "reload:after")).toHaveLength(1);
    await adapter.prompt("/cache-test");
    expect(notices.at(-1)).toBe("after");

    await adapter.prompt("/extension-reload");
    expect(reload).toHaveBeenCalledTimes(2);
    expect(notices.filter(n => n === "reload:after")).toHaveLength(2);
  } finally {
    await adapter?.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});
