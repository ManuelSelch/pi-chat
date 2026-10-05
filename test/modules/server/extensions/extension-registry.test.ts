import { describe, expect, it, vi } from "vitest";
import { createPiChatExtensionRegistry } from "../../../../src/server/extensions/extension-registry.js";

describe("Pi Chat extension registry", () => {
  it("stores declarative buttons for snapshots", () => {
    const registry = createPiChatExtensionRegistry();
    registry.registerButton({ id: "demo.hello.button", slot: "composer.right", label: "Demo", actionId: "demo.hello" });

    expect(registry.snapshot()).toEqual({
      buttons: [{ id: "demo.hello.button", slot: "composer.right", label: "Demo", actionId: "demo.hello" }],
      badges: [],
      state: {},
    });
  });

  it("stores extension state for snapshots", () => {
    const registry = createPiChatExtensionRegistry();
    registry.setExtensionState("demo", { enabled: true });

    expect(registry.snapshot().state).toEqual({ demo: { enabled: true } });

    registry.clearExtensionState("demo");
    expect(registry.snapshot().state).toEqual({});
  });

  it("stores badges for snapshots", () => {
    const registry = createPiChatExtensionRegistry();
    registry.registerBadge({ id: "demo.status", slot: "session.status", label: "Demo" });

    expect(registry.snapshot().badges).toEqual([
      { id: "demo.status", slot: "session.status", label: "Demo", tone: "neutral" },
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

  it("replaces an owned registration instead of stacking a second one", async () => {
    const registry = createPiChatExtensionRegistry();
    const stale = vi.fn();
    const fresh = vi.fn();
    registry.on("message.final", stale, { owner: "demo" });
    registry.on("message.final", fresh, { owner: "demo" });

    await registry.emit("message.final", { sessionId: "s1", message: { id: "m1", role: "assistant", text: "Hi" } });

    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledOnce();
  });

  it("keeps one badge per owner across reloads", () => {
    const registry = createPiChatExtensionRegistry();
    const badge = { id: "demo.status", slot: "session.status" as const, label: "Demo" };
    registry.registerBadge(badge, { owner: "demo" });
    registry.registerBadge(badge, { owner: "demo" });

    expect(registry.snapshot().badges).toHaveLength(1);
  });

  // An unowned registration is still additive: two extensions that each add a
  // hook must both keep it.
  it("keeps unowned registrations additive", async () => {
    const registry = createPiChatExtensionRegistry();
    const first = vi.fn();
    const second = vi.fn();
    registry.on("message.final", first);
    registry.on("message.final", second);

    await registry.emit("message.final", { sessionId: "s1", message: { id: "m1", role: "assistant", text: "Hi" } });

    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it("hands the same store back to every load of an extension", () => {
    const registry = createPiChatExtensionRegistry();
    const first = registry.store("demo", () => ({ enabled: false }));
    first.enabled = true;

    // What a second session's load of the same extension would see.
    expect(registry.store("demo", () => ({ enabled: false }))).toBe(first);
    expect(registry.store("demo", () => ({ enabled: false })).enabled).toBe(true);
  });
});
