import { describe, expect, it, vi } from "vitest";
import { createPiChatExtensionRegistry } from "../src/server/extension-registry.js";

describe("Pi Chat extension registry", () => {
  it("stores declarative buttons for snapshots", () => {
    const registry = createPiChatExtensionRegistry();
    registry.registerButton({ id: "demo.hello.button", slot: "composer.right", label: "Demo", actionId: "demo.hello" });

    expect(registry.snapshot().buttons).toEqual([
      { id: "demo.hello.button", slot: "composer.right", label: "Demo", actionId: "demo.hello" },
    ]);
  });

  it("runs a registered action", async () => {
    const registry = createPiChatExtensionRegistry();
    const run = vi.fn();
    registry.registerAction({ id: "demo.hello", title: "Say hello", run });

    await registry.runAction("demo.hello", { sessionId: "s1", notify: vi.fn() });

    expect(run).toHaveBeenCalledWith({ sessionId: "s1", notify: expect.any(Function) });
  });

  it("emits lifecycle hooks", async () => {
    const registry = createPiChatExtensionRegistry();
    const handler = vi.fn();
    registry.on("message.final", handler);

    await registry.emit("message.final", { sessionId: "s1", message: { id: "m1", role: "assistant", text: "Hi" } });

    expect(handler).toHaveBeenCalledWith({ sessionId: "s1", message: { id: "m1", role: "assistant", text: "Hi" } });
  });
});
