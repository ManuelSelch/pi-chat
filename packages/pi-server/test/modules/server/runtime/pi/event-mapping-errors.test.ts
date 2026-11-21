import { describe, expect, it, vi } from "vitest";
import type { RuntimeEvent } from "../../../../../src/runtime/contracts.js";
import { createSessionEventHandler, type SessionEvent } from "../../../../../src/runtime/pi/event-mapping.js";

function setup() {
  const events: RuntimeEvent[] = [];
  const state = { currentRunId: "run-1", lastError: undefined as string | undefined };
  const handler = createSessionEventHandler({
    session: { isStreaming: true } as never,
    identity: {} as never,
    state,
    inFlightTools: new Set(),
    emit: event => events.push(event),
    clearAbortWatchdog: vi.fn(),
  });
  return { events, handler };
}

function failedMessage(message: string) {
  return {
    type: "message_end",
    message: { role: "assistant", stopReason: "error", errorMessage: message, content: [], timestamp: 1 },
  } as unknown as SessionEvent;
}

describe("model error events", () => {
  it("publishes each error immediately at message_end without waiting for agent_settled", () => {
    const { events, handler } = setup();

    handler(failedMessage("Quota reached"));
    handler(failedMessage("Second provider error"));

    expect(events.filter(event => event.type === "notification")).toEqual([
      { type: "notification", level: "error", message: "Quota reached" },
      { type: "notification", level: "error", message: "Second provider error" },
    ]);
    expect(events.some(event => event.type === "runtimeStatus" && event.status === "idle")).toBe(false);
  });
});
