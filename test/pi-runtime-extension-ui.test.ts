import { describe, expect, it } from "vitest";
import { PiRuntimeAdapter } from "../src/server/pi-runtime-adapter.js";

/**
 * Pi emits `session_start` from `session.bindExtensions`, which only the
 * terminal modes call. This host binds its UI context directly on the runner
 * instead, so without an explicit emit the event never fired here and every
 * extension that captures `ctx.ui` from it — the documented way to reach the
 * dialog surface — was left unable to ask a question.
 */
function fakeRuntime() {
  const calls: string[] = [];
  let capturedUi: unknown;
  const session = {
    sessionId: "s1",
    messages: [] as unknown[],
    isIdle: true,
    extensionRunner: {
      setUIContext: (uiContext: unknown) => {
        capturedUi = uiContext;
        calls.push("setUIContext");
      },
      emit: async (event: { type: string }) => {
        calls.push(`emit:${event.type}`);
      },
    },
    subscribe: () => () => {},
  };

  const adapter = new (PiRuntimeAdapter as unknown as new (runtime: unknown, models: string[]) => PiRuntimeAdapter)(
    { session, cwd: "/tmp" },
    [],
  );

  return { adapter, calls, ui: () => capturedUi };
}

describe("extensions are started with a dialog surface", () => {
  it("emits session_start so extensions can capture ctx.ui", async () => {
    const runtime = fakeRuntime();

    await (runtime.adapter as unknown as { startExtensions(): Promise<void> }).startExtensions();

    expect(runtime.calls).toEqual(["setUIContext", "emit:session_start"]);
  });

  // The order above is the point: an extension that captures the surface at
  // session_start keeps whatever was bound at that moment, so binding later
  // would hand out the no-op context forever.
  it("binds a UI context that can ask a blocking question", () => {
    const runtime = fakeRuntime();

    expect(typeof (runtime.ui() as { input?: unknown }).input).toBe("function");
  });
});
