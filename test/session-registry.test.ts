import { describe, expect, it, vi } from "vitest";
import { FakeRuntimeAdapter } from "../src/server/runtime-adapter.js";
import { SessionRegistry } from "../src/server/session-registry.js";

function adapterWith(overrides: Partial<ReturnType<FakeRuntimeAdapter["snapshot"]>>): FakeRuntimeAdapter {
  const adapter = new FakeRuntimeAdapter();
  const base = adapter.snapshot();
  vi.spyOn(adapter, "snapshot").mockReturnValue({ ...base, ...overrides });
  return adapter;
}

describe("SessionRegistry", () => {
  it("keeps sessions apart and routes events with their session id", () => {
    const events: string[] = [];
    const registry = new SessionRegistry((sessionId, event) => events.push(`${sessionId}:${event.type}`));
    const a = adapterWith({ sessionId: "a" });
    const b = adapterWith({ sessionId: "b" });

    registry.add(a);
    registry.add(b);
    expect(registry.list().map((session) => session.sessionId)).toEqual(["a", "b"]);

    void b.prompt("hi");
    expect(events.every((entry) => entry.startsWith("b:"))).toBe(true);
  });

  it("focuses the existing tab when the same session is opened twice", () => {
    const registry = new SessionRegistry(() => {});
    registry.add(adapterWith({ sessionId: "a" }));
    registry.add(adapterWith({ sessionId: "b" }));

    registry.add(adapterWith({ sessionId: "a" }));

    expect(registry.list()).toHaveLength(2);
    expect(registry.activeSessionId()).toBe("a");
  });

  it("reports a status per tab for the coloured dot", () => {
    const registry = new SessionRegistry(() => {});
    registry.add(adapterWith({ sessionId: "idle", projectPath: "/tmp/one", sessionName: "First" }));
    registry.add(adapterWith({ sessionId: "busy", projectPath: "/tmp/two", isStreaming: true }));
    registry.add(adapterWith({
      sessionId: "asking",
      projectPath: "/tmp/three",
      prompts: [{ id: "p1", kind: "confirm", title: "Allow?" }],
    }));

    expect(registry.tabs().map((tab) => [tab.sessionId, tab.status])).toEqual([
      ["idle", "idle"],
      ["busy", "running"],
      ["asking", "blocked"],
    ]);
    expect(registry.tabs()[0]).toMatchObject({ title: "First", projectName: "one" });
    // A blocked session outranks streaming: it is waiting on the user.
    expect(registry.tabs()[2]!.title).toBe("New session");
  });

  it("closes a tab, disposing its runtime and unsubscribing it", async () => {
    const events: string[] = [];
    const registry = new SessionRegistry((sessionId) => events.push(sessionId));
    const a = adapterWith({ sessionId: "a" });
    registry.add(a);
    registry.add(adapterWith({ sessionId: "b" }));
    const dispose = vi.spyOn(a, "dispose");

    await registry.close("a");

    expect(dispose).toHaveBeenCalled();
    expect(registry.list().map((session) => session.sessionId)).toEqual(["b"]);
    expect(registry.activeSessionId()).toBe("b");

    void a.prompt("ignored");
    expect(events).not.toContain("a");
  });
});

describe("replacing a live session", () => {
  it("keeps the tab in place and routes events to the replacement", async () => {
    const events: string[] = [];
    const registry = new SessionRegistry((sessionId, event) => events.push(`${sessionId}:${event.type}`));
    const first = adapterWith({ sessionId: "a" });
    registry.add(first);
    registry.add(adapterWith({ sessionId: "b" }));
    const replacement = adapterWith({ sessionId: "a" });
    const disposed = vi.spyOn(first, "dispose");

    await registry.replace("a", replacement);

    expect(registry.list().map((session) => session.sessionId)).toEqual(["a", "b"]);
    expect(registry.get("a")).toBe(replacement);
    expect(disposed).toHaveBeenCalled();

    void replacement.prompt("hi");
    expect(events.filter((entry) => entry.startsWith("a:")).length).toBeGreaterThan(0);
  });

  it("refuses a replacement carrying a different session id", async () => {
    const registry = new SessionRegistry(() => {});
    registry.add(adapterWith({ sessionId: "a" }));
    const other = adapterWith({ sessionId: "other" });

    await expect(registry.replace("a", other)).rejects.toThrow(/expected a/);
    expect(registry.get("a")).not.toBe(other);
  });
});
