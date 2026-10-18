import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Result } from "@manuelselch/pi-sdk/contract";
import { V2Connection, type V2ConnectionHost } from "../../../../src/server/transport/v2-connection.js";

const request = (method = "server.initialize", id = "r1", params: object = {}, sessionId?: string) => JSON.stringify({ version: 2, type: "request", requestId: id, method, params: method === "server.initialize" ? { client: { name: "test", version: "1" }, capabilities: ["presentation", "future"] } : params, ...(sessionId ? { sessionId } : {}) });
const initialized: Result<"server.initialize"> = { protocolVersion: 2, serverVersion: "0", serverInstanceId: "server", connectionId: "connection", capabilities: ["presentation"], inventory: { revision: 0, sessions: [] }, projects: { revision: 0, catalogue: { projects: [] } }, snapshots: [] };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function setup(overrides: Partial<V2ConnectionHost> = {}, limits: import("../../../../src/server/transport/v2-connection.js").V2ConnectionLimits = {}) {
  const sent: any[] = [];
  const close = vi.fn();
  let current = false;
  const host: V2ConnectionHost = {
    serverInstanceId: "server", connectionId: "connection", capabilities: ["presentation"],
    isWritable: () => true, isController: () => current,
    claim: () => { current = true; },
    send: (message) => { sent.push(message); }, close,
    prepareInitialize: async () => () => initialized,
    execute: vi.fn(async () => ({ kind: "completed" as const, result: { state: "completed" } })),
    outcome: vi.fn(), ...overrides,
  };
  const connection = new V2Connection(host, limits);
  return { connection, host, sent, close, displace: () => { current = false; } };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe("v2 connection admission and correlation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not claim control until preparation succeeds and initialization is queued atomically", async () => {
    const ready = deferred<() => Result<"server.initialize">>();
    const { connection, host, sent } = setup({ prepareInitialize: () => ready.promise });
    const claim = vi.spyOn(host, "claim");
    connection.receive(request());
    expect(claim).not.toHaveBeenCalled(); expect(sent).toEqual([]);
    ready.resolve(() => initialized); await settle();
    expect(claim).toHaveBeenCalledOnce();
    expect(sent).toEqual([{ version: 2, type: "response", requestId: "r1", ok: true, result: initialized }]);
    connection.receive(request("server.ping", "r2")); await settle();
    expect(sent[1]).toMatchObject({ requestId: "r2", ok: true, result: { state: "completed" } });
    connection.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects v1, malformed envelopes and work before readiness without invoking the host", async () => {
    const { connection, host, sent } = setup();
    for (const input of ["not JSON", JSON.stringify({ version: 1, type: "prompt" }), request("message.send", "work", { message: "hello" }, "s")]) connection.receive(input);
    expect(sent.map((message) => message.error.code)).toEqual(["invalidRequest", "unsupportedVersion", "notInitialized"]);
    expect(host.execute).not.toHaveBeenCalled(); connection.dispose();
  });

  it("rejects unselected optional operations and unknown methods with correlated errors", async () => {
    const { connection, host, sent } = setup(); connection.receive(request()); await settle();
    connection.receive(request("file.open", "file", { path: "./file" }, "s"));
    connection.receive(request("future.operation", "unknown"));
    await settle();
    expect(sent.slice(1)).toEqual([
      { version: 2, type: "response", requestId: "file", ok: false, error: { code: "unsupportedOperation", message: expect.any(String) } },
      { version: 2, type: "response", requestId: "unknown", ok: false, error: { code: "unsupportedOperation", message: expect.any(String) } },
    ]);
    expect(host.execute).not.toHaveBeenCalled(); connection.dispose();
  });

  it("publishes acceptance before synchronous runtime events and reports a later failure only as an outcome", async () => {
    const log: string[] = [];
    const { connection, host, sent } = setup({ execute: async () => ({ kind: "accepted", operationId: "op", run: () => { log.push("Pi invoked"); expect(sent.at(-1)).toMatchObject({ ok: true, result: { state: "accepted", operationId: "op" } }); throw new Error("Pi handoff failed"); } }), outcome: (_request, _operationId, outcome) => { log.push(outcome); } });
    const execute = vi.spyOn(host, "execute");
    connection.receive(request()); await settle();
    connection.receive(request("message.send", "message", { message: "hello" }, "s")); await settle();
    expect(log).toEqual(["Pi invoked", "failed"]);
    expect(sent.filter((message) => message.requestId === "message")).toHaveLength(1);
    expect(execute).toHaveBeenCalledOnce(); connection.dispose();
  });

  it("does not let long operations block abort or prompt answers", async () => {
    const work = deferred<void>();
    const { connection, sent } = setup({ execute: async (command) => command.method === "message.send" ? { kind: "accepted", operationId: "op", run: () => work.promise } : { kind: "completed", result: { state: "completed" } } });
    connection.receive(request()); await settle();
    connection.receive(request("message.send", "message", { message: "hello" }, "s"));
    connection.receive(request("run.abort", "abort", {}, "s"));
    connection.receive(request("prompt.answer", "answer", { promptId: "p", result: { cancelled: true } }, "s"));
    await settle();
    expect(sent.slice(1).map((message) => message.requestId)).toEqual(["message", "abort", "answer"]);
    work.resolve(); await settle(); connection.dispose();
  });

  it("never sends a completed response to a displaced or closed origin and never cancels admitted work", async () => {
    const execution = deferred<{ kind: "completed"; result: object }>();
    const { connection, sent, displace } = setup({ execute: () => execution.promise });
    connection.receive(request()); await settle();
    connection.receive(request("server.ping", "late"));
    displace(); execution.resolve({ kind: "completed", result: { state: "completed" } }); await settle();
    expect(sent).toHaveLength(1);
    connection.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps admitted execution alive when its accepted response cannot be delivered", async () => {
    const admitted = deferred<import("../../../../src/server/transport/v2-connection.js").V2Execution>();
    const run = vi.fn();
    const { connection, sent, host } = setup({ execute: () => admitted.promise });
    connection.receive(request()); await settle();
    connection.receive(request("message.send", "message", { message: "hello" }, "s"));
    connection.dispose();
    admitted.resolve({ kind: "accepted", operationId: "op", run }); await settle();
    expect(run).toHaveBeenCalledOnce();
    expect(sent).toHaveLength(1);
    expect(host.outcome).toHaveBeenCalledWith(expect.objectContaining({ requestId: "message" }), "op", "completed", undefined);
  });

  it("keeps a completed mutation successful when a later catalogue refresh fails", async () => {
    const refresh = vi.fn(() => { throw new Error("Catalogue unavailable"); });
    const { connection, sent } = setup({ capabilities: ["presentation", "project.pin"],
      prepareInitialize: async () => () => ({ ...initialized, capabilities: ["presentation", "project.pin"] }),
      execute: async () => ({ kind: "completed", result: { state: "completed" }, afterResponse: refresh }),
    });
    connection.receive(JSON.stringify({ version: 2, type: "request", requestId: "init", method: "server.initialize", params: { client: { name: "test", version: "1" }, capabilities: ["presentation", "project.pin"] } }));
    await settle();
    connection.receive(request("project.pin", "pin", { path: "/p", pinned: true })); await settle();
    expect(refresh).toHaveBeenCalledOnce();
    expect(sent.filter((message) => message.requestId === "pin")).toEqual([expect.objectContaining({ ok: true, result: { state: "completed" } })]);
    connection.dispose();
  });

  it("does not turn a post-response outcome-publication failure into a second response", async () => {
    const { connection, sent } = setup({ execute: async () => ({ kind: "accepted", operationId: "op", run() {} }), outcome() { throw new Error("refresh failed"); } });
    connection.receive(request()); await settle();
    connection.receive(request("message.send", "message", { message: "hello" }, "s")); await settle();
    expect(sent.filter((message) => message.requestId === "message")).toEqual([expect.objectContaining({ ok: true })]);
    connection.dispose();
  });

  it("bounds pending requests without counting admitted long-running Pi operations", async () => {
    const pending = deferred<import("../../../../src/server/transport/v2-connection.js").V2Execution>();
    const { connection, sent } = setup({ execute: () => pending.promise }, { maxPending: 1 });
    connection.receive(request()); await settle();
    connection.receive(request("server.ping", "first"));
    connection.receive(request("server.ping", "second"));
    expect(sent.at(-1)).toMatchObject({ requestId: "second", ok: false, error: { code: "limitExceeded" } });
    pending.resolve({ kind: "completed", result: { state: "completed" } }); await settle();
    expect(sent.at(-1)).toMatchObject({ requestId: "first", ok: true });
    connection.dispose();
  });

  it("bounds IDs and frames and never evicts seen IDs to allow accidental replay", async () => {
    const { connection, sent, close } = setup({}, { maxRequestIds: 2 });
    connection.receive(request()); await settle();
    connection.receive(request("server.ping", "ping")); await settle();
    connection.receive(request("server.ping", "overflow"));
    expect(sent.at(-1)).toMatchObject({ type: "protocolError", error: { code: "limitExceeded" } });
    expect(close).toHaveBeenCalled();
    const oversized = setup({}, { maxMessageCharacters: 1 });
    oversized.connection.receive("{}");
    expect(oversized.close).toHaveBeenCalled();
    connection.dispose(); oversized.connection.dispose();
  });

  it("refuses inconsistent initial inventories before displacing a working controller", async () => {
    const { connection, sent, host, close } = setup({ prepareInitialize: async () => () => ({ ...initialized, snapshots: [{ sessionId: "extra" }] } as unknown as Result<"server.initialize">) });
    const claim = vi.spyOn(host, "claim");
    connection.receive(request()); await settle();
    expect(claim).not.toHaveBeenCalled(); expect(close).toHaveBeenCalled();
    expect(sent[0]).toMatchObject({ requestId: "r1", ok: false });
    connection.dispose();
  });

  it("treats duplicate IDs as protocol errors and bounds initial synchronization", async () => {
    const ready = deferred<() => Result<"server.initialize">>();
    const { connection, sent, close } = setup({ prepareInitialize: () => ready.promise });
    connection.receive(request()); connection.receive(request());
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "protocolError", error: { code: "duplicateRequestId" } });
    expect(close).toHaveBeenCalled();
    ready.resolve(() => initialized); await settle(); expect(sent).toHaveLength(1);
    const slow = setup({ prepareInitialize: () => new Promise(() => {}) });
    slow.connection.receive(request()); vi.advanceTimersByTime(10_000);
    expect(slow.close).toHaveBeenCalled();
    expect(slow.sent[0]).toMatchObject({ type: "protocolError", error: { code: "initializationTimeout" } });
    slow.connection.dispose(); connection.dispose();
  });
});
