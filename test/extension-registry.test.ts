import { describe, expect, it, vi } from "vitest";
import { createPiChatExtensionRegistry } from "../src/server/extension-registry.js";

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
    registry.setExtensionState("multiuser", { participants: 2 });

    expect(registry.snapshot().state).toEqual({ multiuser: { participants: 2 } });

    registry.clearExtensionState("multiuser");
    expect(registry.snapshot().state).toEqual({});
  });

  it("resolves per-connection badges for each snapshot", () => {
    const registry = createPiChatExtensionRegistry();
    registry.registerBadge(({ connectionId }) => ({
      id: "multiuser.role",
      slot: "session.status",
      label: connectionId === "guest" ? "Guest" : "Owner",
    }));

    expect(registry.snapshot({ connectionId: "guest" }).badges).toEqual([
      { id: "multiuser.role", slot: "session.status", label: "Guest", tone: "neutral" },
    ]);
  });

  it("resolves per-connection state for each snapshot", () => {
    const registry = createPiChatExtensionRegistry();
    registry.setExtensionState("multiuser", ({ connectionId }: { connectionId?: string }) => ({ role: connectionId === "guest" ? "guest" : "owner" }));

    expect(registry.snapshot({ connectionId: "guest" }).state).toEqual({ multiuser: { role: "guest" } });
    expect(registry.snapshot({ connectionId: "owner" }).state).toEqual({ multiuser: { role: "owner" } });
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

  it("authorizes by default and stops on first denial", async () => {
    const registry = createPiChatExtensionRegistry();
    registry.use("prompt.authorize", () => ({ allow: true }));
    registry.use("prompt.authorize", () => ({ allow: false, reason: "Read only" }));
    registry.use("prompt.authorize", () => { throw new Error("should not run"); });

    await expect(registry.authorize("prompt.authorize", { connectionId: "c1", sessionId: "s1" })).resolves.toEqual({ allow: false, reason: "Read only" });
    await expect(registry.authorize("action.authorize", { connectionId: "c1" })).resolves.toEqual({ allow: true });
  });

  it("emits connection lifecycle hooks", async () => {
    const registry = createPiChatExtensionRegistry();
    const opened = vi.fn();
    const closed = vi.fn();
    registry.on("connection.open", opened);
    registry.on("connection.close", closed);

    await registry.emit("connection.open", { connectionId: "c1" });
    await registry.emit("connection.close", { connectionId: "c1" });

    expect(opened).toHaveBeenCalledWith({ connectionId: "c1" });
    expect(closed).toHaveBeenCalledWith({ connectionId: "c1" });
  });
});
