import { describe, expect, it, vi } from "vitest";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";
import { SessionRegistry } from "../../../../src/server/application/session-registry.js";

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

  it("returns the existing runtime when registered twice without storing focus", () => {
    const registry = new SessionRegistry(() => {});
    registry.add(adapterWith({ sessionId: "a" }));
    registry.add(adapterWith({ sessionId: "b" }));

    registry.add(adapterWith({ sessionId: "a" }));

    expect(registry.list()).toHaveLength(2);
    expect(registry.list().map(session => session.sessionId)).toEqual(["a", "b"]);
  });

  it("keeps snapshots associated with their runtime identities", () => {
    const registry = new SessionRegistry(() => {});
    registry.add(adapterWith({ sessionId: "idle", projectPath: "/tmp/one", sessionName: "First" }));
    registry.add(adapterWith({ sessionId: "busy", projectPath: "/tmp/two", isStreaming: true }));
    registry.add(adapterWith({
      sessionId: "asking",
      projectPath: "/tmp/three",
      prompts: [{ id: "p1", kind: "confirm", title: "Allow?" }],
    }));

    expect(registry.list().map(({ sessionId, adapter }) => [sessionId, adapter.snapshot().isStreaming, adapter.snapshot().prompts.length])).toEqual([
      ["idle", false, 0], ["busy", true, 0], ["asking", false, 1],
    ]);
  });

  it("converges concurrent close requests on one disposal", async () => {
    const registry = new SessionRegistry(() => {}); const adapter = adapterWith({ sessionId: "a" }); registry.add(adapter);
    let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
    const dispose = vi.spyOn(adapter, "dispose").mockImplementation(() => pending);
    const first = registry.close("a"); const second = registry.close("a");
    expect(dispose).toHaveBeenCalledOnce(); release(); await Promise.all([first, second]);
    expect(registry.has("a")).toBe(false);
  });

  it("retains a partially disposed runtime until an explicit close retry succeeds", async () => {
    const registry = new SessionRegistry(() => {});
    const adapter = adapterWith({ sessionId: "a" });
    registry.add(adapter);
    const dispose = vi.spyOn(adapter, "dispose").mockImplementationOnce(() => { throw new Error("partial teardown"); });
    await expect(registry.close("a")).rejects.toThrow("partial teardown");
    expect(registry.has("a")).toBe(true);
    await registry.close("a");
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(registry.has("a")).toBe(false);
  });

  it("closes a runtime and unsubscribes it without changing server-side focus", async () => {
    const events: string[] = [];
    const registry = new SessionRegistry((sessionId) => events.push(sessionId));
    const a = adapterWith({ sessionId: "a" });
    registry.add(a);
    registry.add(adapterWith({ sessionId: "b" }));
    const dispose = vi.spyOn(a, "dispose");

    await registry.close("a");

    expect(dispose).toHaveBeenCalled();
    expect(registry.list().map((session) => session.sessionId)).toEqual(["b"]);

    void a.prompt("ignored");
    expect(events).not.toContain("a");
  });
});

describe("replacing a live session", () => {
  it("keeps the runtime identity and routes events to the replacement", async () => {
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
