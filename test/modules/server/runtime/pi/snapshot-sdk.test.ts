import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { createAgentSession, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { PiRuntimeAdapter } from "../../../../../src/server/runtime/pi/pi-runtime-adapter.js";
import type { RuntimeEvent } from "../../../../../src/server/runtime/contracts.js";

let cwd = "";
const adapters: PiRuntimeAdapter[] = [];
afterEach(async () => {
  for (const adapter of adapters.splice(0)) await adapter.dispose();
  if (cwd) await rm(cwd, { recursive: true, force: true });
  cwd = "";
});

async function setup(manager = SessionManager.inMemory()) {
  cwd ||= await realpath(await mkdtemp(join(tmpdir(), "pi-chat-snapshot-sdk-")));
  const { session } = await createAgentSession({
    cwd, agentDir: join(cwd, "agent"), sessionManager: manager,
    settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
  });
  const adapter = new (PiRuntimeAdapter as unknown as new (runtime: unknown) => PiRuntimeAdapter)({
    session, cwd, dispose: async () => session.dispose(),
  });
  adapters.push(adapter);
  return { session, adapter };
}

it("uses a single SDK snapshot refresh for real extension custom messages", async () => {
  const { session, adapter } = await setup();
  const events: RuntimeEvent[] = [];
  adapter.subscribe(event => events.push(event));
  await session.sendCustomMessage({ customType: "memory", content: "Visible memory", display: true });
  await session.sendCustomMessage({ customType: "internal", content: "Hidden state", display: false });
  expect(adapter.snapshot().messages).toMatchObject([{ role: "custom", customType: "memory", text: "Visible memory" }]);
  // The SDK emits both a persisted entry and a custom message with a different
  // object from reconstructed context. Do not append either as a second bubble.
  expect(events.filter(event => event.type === "messageFinal")).toHaveLength(0);
  expect(events.filter(event => event.type === "sessionMetadataChanged")).toHaveLength(2);
});

it("captures actual SDK finalized messages before their branch append", async () => {
  const { session, adapter } = await setup();
  const model = session.modelRuntime.getModel("anthropic", "claude-sonnet-4-5")!;
  await session.modelRuntime.setRuntimeApiKey("anthropic", "test-no-network");
  session.agent.state.model = model;
  session.agent.streamFunction = async () => {
    const message = {
      role: "assistant" as const, content: [{ type: "text" as const, text: "Answer" }],
      api: model.api, provider: model.provider, model: model.id,
      usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop" as const, timestamp: Date.now(),
    };
    return {
      async *[Symbol.asyncIterator]() { yield { type: "done" as const, reason: "stop" as const, message }; },
      result: async () => message,
    } as unknown as Awaited<ReturnType<typeof session.agent.streamFunction>>;
  };
  const observed: string[] = [];
  adapter.subscribe(event => {
    if (event.type !== "messageFinal") return;
    expect(adapter.snapshot().messages).toContainEqual(event.message);
    expect(session.sessionManager.getBranch().some(entry =>
      entry.type === "message" && entry.message.role === event.message.role,
    )).toBe(false);
    observed.push(event.message.role);
  });
  await adapter.prompt("Question");
  expect(observed).toEqual(["user", "assistant"]);
  expect(adapter.snapshot().messages.filter(message => message.role === "user" || message.role === "assistant"))
    .toMatchObject([{ role: "user", text: "Question" }, { role: "assistant", text: "Answer" }]);
});

it("restores SDK custom messages and compacted context on reopening", async () => {
  const manager = SessionManager.inMemory();
  manager.appendMessage({ role: "user", content: "Old question", timestamp: 1 });
  const kept = manager.appendMessage({ role: "user", content: "Retained question", timestamp: 2 });
  manager.appendCustomMessageEntry("memory", "Retained memory", true);
  manager.appendCompaction("Summary of old question", kept, 1000);
  const first = await setup(manager);
  const restored = await setup(manager);
  const visible = (adapter: PiRuntimeAdapter) => adapter.snapshot().messages.map(({ id: _id, ...message }) => message);
  expect(visible(first.adapter)).toMatchObject([
    { role: "custom", customType: "compaction-summary", text: "Summary of old question" },
    { role: "user", text: "Retained question" },
    { role: "custom", customType: "memory", text: "Retained memory" },
  ]);
  expect(visible(restored.adapter)).toEqual(visible(first.adapter));
});
