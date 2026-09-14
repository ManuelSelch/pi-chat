import { describe, expect, it } from "vitest";
import { PiRuntimeAdapter } from "../src/server/pi-runtime-adapter.js";
import type { RuntimeEvent } from "../src/server/runtime-adapter.js";

type SessionEvent =
  | { type: "compaction_start"; reason: "manual" | "threshold" | "overflow" }
  | {
      type: "compaction_end";
      reason: "manual" | "threshold" | "overflow";
      result: undefined;
      aborted: boolean;
      willRetry: boolean;
      errorMessage?: string;
    }
  | { type: "agent_settled" };

/**
 * Enough of a session to drive `bindSession`. Compaction is reported through
 * events rather than `isStreaming`, which is the whole point of these tests, so
 * the two flags are set independently.
 */
function fakeRuntime() {
  const state = { isStreaming: false, isCompacting: false };
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
      return state.isCompacting;
    },
    get isIdle() {
      return !state.isStreaming && !state.isCompacting;
    },
    model: { provider: "p", id: "m" },
    thinkingLevel: "off",
    getAvailableThinkingLevels: () => ["off"],
    promptTemplates: [] as unknown[],
    resourceLoader: { getSkills: () => ({ skills: [] }) },
    extensionRunner: {
      setUIContext: () => {},
      getCommand: () => undefined,
      getRegisteredCommands: () => [],
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
    emit: (event: SessionEvent) => emit(event),
    statuses: () => events.filter((event) => event.type === "runtimeStatus").map((event) => event.status),
  };
}

describe("compaction is reported as busy", () => {
  // Auto-compaction runs before the turn the user asked for. The session does
  // not count it as streaming, so the browser used to show nothing for several
  // seconds while still believing it was idle.
  it("reports running while an automatic compaction is under way", () => {
    const runtime = fakeRuntime();

    runtime.state.isCompacting = true;
    runtime.emit({ type: "compaction_start", reason: "threshold" });

    expect(runtime.statuses()).toEqual(["running"]);
    expect(runtime.events.some((event) => event.type === "notification" && /compacting/i.test(event.message))).toBe(true);
  });

  it("returns to idle once compaction finishes outside a run", () => {
    const runtime = fakeRuntime();

    runtime.state.isCompacting = true;
    runtime.emit({ type: "compaction_start", reason: "threshold" });
    // The flag is still set when the event fires; it is cleared afterwards,
    // so it must not be what decides whether the session is idle again.
    runtime.emit({ type: "compaction_end", reason: "threshold", result: undefined, aborted: false, willRetry: false });

    expect(runtime.statuses()).toEqual(["running", "idle"]);
  });

  it("stays running when the agent will retry after compacting", () => {
    const runtime = fakeRuntime();

    runtime.state.isCompacting = true;
    runtime.emit({ type: "compaction_start", reason: "overflow" });
    runtime.emit({ type: "compaction_end", reason: "overflow", result: undefined, aborted: false, willRetry: true });

    expect(runtime.statuses()).toEqual(["running"]);
  });

  it("stays running when compaction happened inside a run", () => {
    const runtime = fakeRuntime();

    runtime.state.isStreaming = true;
    runtime.state.isCompacting = true;
    runtime.emit({ type: "compaction_start", reason: "threshold" });
    runtime.emit({ type: "compaction_end", reason: "threshold", result: undefined, aborted: false, willRetry: false });

    expect(runtime.statuses()).toEqual(["running"]);

    runtime.state.isStreaming = false;
    runtime.state.isCompacting = false;
    runtime.emit({ type: "agent_settled" });

    expect(runtime.statuses()).toEqual(["running", "idle"]);
  });

  it("reports a failed compaction instead of leaving it silent", () => {
    const runtime = fakeRuntime();

    runtime.emit({ type: "compaction_start", reason: "threshold" });
    runtime.emit({
      type: "compaction_end",
      reason: "threshold",
      result: undefined,
      aborted: false,
      willRetry: false,
      errorMessage: "summary model unavailable",
    });

    expect(
      runtime.events.some(
        (event) => event.type === "notification" && event.level === "error" && event.message.includes("summary model unavailable"),
      ),
    ).toBe(true);
  });

  // `compact()` already announces itself, so the event must not say it twice.
  it("does not announce a manual compaction twice", () => {
    const runtime = fakeRuntime();

    runtime.emit({ type: "compaction_start", reason: "manual" });

    expect(runtime.events.filter((event) => event.type === "notification")).toHaveLength(0);
    expect(runtime.statuses()).toEqual(["running"]);
  });

  it("counts a compacting session as busy in the snapshot", () => {
    const runtime = fakeRuntime();

    expect(runtime.adapter.snapshot().isStreaming).toBe(false);

    runtime.state.isCompacting = true;
    expect(runtime.adapter.snapshot().isStreaming).toBe(true);
  });
});
