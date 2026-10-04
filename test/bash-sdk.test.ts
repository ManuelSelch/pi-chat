import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createAgentSession, SessionManager, SettingsManager, convertToLlm } from "@earendil-works/pi-coding-agent";
import { PiRuntimeAdapter } from "../src/server/runtime/pi/pi-runtime-adapter.js";

let cwd: string;
let adapter: PiRuntimeAdapter | undefined;
afterEach(async () => {
  await adapter?.dispose();
  adapter = undefined;
  if (cwd) await rm(cwd, { recursive: true, force: true });
  cwd = "";
});

async function setup(manager?: SessionManager) {
  cwd ||= await realpath(await mkdtemp(join(tmpdir(), "pi-chat-bash-sdk-")));
  const { session } = await createAgentSession({ cwd, agentDir: join(cwd, "agent"), sessionManager: manager ?? SessionManager.create(cwd, join(cwd, "sessions")), settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }) });
  adapter = new (PiRuntimeAdapter as unknown as new (runtime: unknown) => PiRuntimeAdapter)({ session, cwd, dispose: async () => { session.abortBash(); session.dispose(); } });
  return { session, adapter };
}

it("executes real shell commands, persists both context modes, and restores them", async () => {
  const { adapter: runtime, session } = await setup();
  await runtime.prompt("!pwd");
  await runtime.prompt("!!printf 'secret-marker\\n'");
  await runtime.prompt("!printf 'line1\\nline2\\n'; exit 7");
  const messages = runtime.snapshot().messages;
  expect(messages).toHaveLength(3);
  expect(messages[0]).toMatchObject({ role: "bash", bash: { status: "success", output: `${cwd}\n` } });
  expect(messages[2]).toMatchObject({ bash: { status: "error", exitCode: 7, output: "line1\nline2\n" } });
  const context = JSON.stringify(convertToLlm(session.messages));
  expect(context).toContain(cwd);
  expect(context).not.toContain("secret-marker");
  // Pi intentionally does not create a new session file for a bash-only session;
  // persistence starts once the session receives an assistant response.
});

it("cancels a real process", async () => {
  const { adapter: runtime, session } = await setup();
  const run = runtime.prompt("!printf 'started\\n'; sleep 30");
  await vi.waitFor(() => expect(session.isBashRunning).toBe(true), { timeout: 3000 });
  await runtime.abort();
  await run;
  expect(runtime.snapshot().isStreaming).toBe(false);
  expect(runtime.snapshot().messages).toMatchObject([{ bash: { status: "cancelled" } }]);
});

it("passes only included bash output to a subsequent ordinary SDK prompt", async () => {
  const { adapter: runtime, session } = await setup();
  await runtime.prompt("!printf 'public-marker'");
  await runtime.prompt("!!printf 'secret-marker'");
  const model = session.modelRuntime.getModel("anthropic", "claude-sonnet-4-5")!;
  expect(model).toBeTruthy();
  await session.modelRuntime.setRuntimeApiKey("anthropic", "test-no-network");
  session.agent.state.model = model;
  let outgoing = "";
  session.agent.streamFunction = async (_model, context) => {
    outgoing = JSON.stringify(context.messages);
    const message = {
      role: "assistant" as const, content: [{ type: "text" as const, text: "ok" }],
      api: model.api, provider: model.provider, model: model.id,
      usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop" as const, timestamp: Date.now(),
    };
    return {
      async *[Symbol.asyncIterator]() { yield { type: "done" as const, reason: "stop" as const, message }; },
      result: async () => message,
    } as unknown as Awaited<ReturnType<typeof session.agent.streamFunction>>;
  };
  await runtime.prompt("Use the shell output");
  expect(outgoing).toContain("public-marker");
  expect(outgoing).not.toContain("secret-marker");
  expect(runtime.snapshot().messages.at(-1)).toMatchObject({ role: "assistant", text: "ok" });
});
