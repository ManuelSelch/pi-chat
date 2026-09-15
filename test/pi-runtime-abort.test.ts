import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PiRuntimeAdapter } from "../src/server/pi-runtime-adapter.js";
import type { RuntimeEvent } from "../src/server/runtime-adapter.js";

type SessionEvent = { type: "agent_settled" };

/**
 * A session whose busy flags the test drives by hand, so an abort that Pi never
 * follows with `agent_settled` can be reproduced.
 */
function fakeRuntime() {
  const state = { isStreaming: false, aborts: 0 };
  let emit: (event: SessionEvent) => void = () => {};
  const session = {
    sessionId: "s1",
    sessionFile: undefined,
    sessionName: undefined,
    messages: [] as unknown[],
    get isStreaming() {
      return state.isStreaming;
    },
    get isCompacting() {
      return false;
    },
    get isIdle() {
      return !state.isStreaming;
    },
    model: { provider: "p", id: "m" },
    thinkingLevel: "off",
    getAvailableThinkingLevels: () => ["off"],
    supportsThinking: () => false,
    promptTemplates: [] as unknown[],
    resourceLoader: { getSkills: () => ({ skills: [] }) },
    extensionRunner: {
      setUIContext: () => {},
      getCommand: () => undefined,
      getRegisteredCommands: () => [],
    },
    prompt: async () => {},
    abort: async () => {
      state.aborts += 1;
    },
    subscribe: (listener: (event: SessionEvent) => void) => {
      emit = listener;
      return () => {};
    },
  };

  const adapter = new (PiRuntimeAdapter as unknown as new (runtime: unknown, models: string[]) => PiRuntimeAdapter)(
    { session, cwd: "/tmp" },
    [],
  );

  const events: RuntimeEvent[] = [];
  adapter.subscribe((event) => events.push(event));

  return {
    adapter,
    events,
    state,
    settle: () => emit({ type: "agent_settled" }),
    statuses: () => events.filter((event) => event.type === "runtimeStatus").map((event) => event.status),
  };
}

describe("stopping a run always ends the stopping state", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("goes straight to idle when there is nothing to stop", async () => {
    const runtime = fakeRuntime();

    await runtime.adapter.abort();

    // No run means no `agent_settled`, so an "aborting" here would never be
    // cleared and the composer would sit on "stopping…".
    expect(runtime.statuses()).toEqual(["idle"]);
    expect(runtime.state.aborts).toBe(0);
  });

  it("lets the settled event end a normal stop", async () => {
    const runtime = fakeRuntime();
    runtime.state.isStreaming = true;

    await runtime.adapter.abort();
    expect(runtime.statuses()).toEqual(["aborting"]);

    runtime.state.isStreaming = false;
    runtime.settle();

    expect(runtime.statuses()).toEqual(["aborting", "idle"]);

    // The watchdog was cancelled with it, so no second status follows.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(runtime.statuses()).toEqual(["aborting", "idle"]);
  });

  it("reports idle itself when the settled event never arrives", async () => {
    const runtime = fakeRuntime();
    runtime.state.isStreaming = true;

    await runtime.adapter.abort();
    runtime.state.isStreaming = false;

    await vi.advanceTimersByTimeAsync(1_000);

    expect(runtime.statuses()).toEqual(["aborting", "idle"]);
  });

  it("says so when the session keeps running instead of stopping", async () => {
    const runtime = fakeRuntime();
    runtime.state.isStreaming = true;

    await runtime.adapter.abort();
    await vi.advanceTimersByTimeAsync(20_000);

    expect(runtime.statuses()).toEqual(["aborting", "running"]);
    expect(runtime.events.some((event) => event.type === "notification" && /did not stop/i.test(event.message))).toBe(true);
  });

  it("hands the status to the next run rather than the old watchdog", async () => {
    const runtime = fakeRuntime();
    runtime.state.isStreaming = true;
    await runtime.adapter.abort();

    await runtime.adapter.prompt("again");
    runtime.state.isStreaming = true;
    await vi.advanceTimersByTimeAsync(20_000);

    expect(runtime.statuses()).toEqual(["aborting"]);
  });
});
