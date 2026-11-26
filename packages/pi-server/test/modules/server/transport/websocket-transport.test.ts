import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";
import { v2Socket } from "../../../infra/v2-socket.js";
import { ProjectSessionService } from "../../../../src/projects/project-session-service.js";
import { createPiServer, type PiServer } from "../../../../src/index.js";
import { initializeResultSchema, type Result } from "@manuelselch/pi-sdk/protocol";

describe("v2 WebSocket transport", () => {
  let server: PiServer;
  afterEach(async () => { if (server) await server.close(); vi.restoreAllMocks(); });
  async function listen(runtime?: FakeRuntimeAdapter) {
    server = await createPiServer({ runtime: runtime }); await new Promise<void>(resolve => server.httpServer.listen(0, "127.0.0.1", resolve));
    const client = await v2Socket(server); const initial = await client.initialize(); return { ...client, initial };
  }
  it("keeps multiple clients connected without transferring exclusive control", async () => {
    const first = await listen(new FakeRuntimeAdapter());
    const second = await v2Socket(server);
    const initial = await second.initialize();

    first.send("server.ping", "first");
    second.send("server.ping", "second");

    expect(await first.response("first")).toMatchObject({ ok: true });
    expect(await second.response("second")).toMatchObject({ ok: true });
    expect(initial.snapshots[0]!.sessionId).toBe(first.initial.snapshots[0]!.sessionId);
  });
  it("initializes with an empty inventory when no runtime is open", async () => {
    const client = await listen(); expect(client.initial.inventory.sessions).toEqual([]); expect(client.initial.snapshots).toEqual([]);
  });
  it("survives malformed input without losing the initialized controller", async () => {
    const client = await listen(new FakeRuntimeAdapter()); client.socket.send("not json");
    expect(await client.wait(message => message.type === "protocolError")).toMatchObject({ error: { code: "invalidRequest" } });
    client.send("server.ping", "ping"); expect(await client.response("ping")).toMatchObject({ ok: true });
  });
  it("returns argument completions without running Pi or publishing snapshots", async () => {
    const runtime = new FakeRuntimeAdapter(); const complete = vi.spyOn(runtime, "completeCommandArguments").mockResolvedValue([{ value: "staging", label: "Staging" }]);
    const prompt = vi.spyOn(runtime, "prompt"); const client = await listen(runtime); const id = client.initial.snapshots[0]!.sessionId;
    client.send("command.complete", "c1", { commandName: "deploy:2", argumentPrefix: "st" }, id);
    expect(await client.response("c1")).toMatchObject({ ok: true, result: { items: [{ value: "staging", label: "Staging" }] } });
    expect(complete).toHaveBeenCalledWith("deploy:2", "st"); expect(prompt).not.toHaveBeenCalled();
    complete.mockRejectedValueOnce(new Error("private failure"));
    client.send("command.complete", "c2", { commandName: "deploy", argumentPrefix: "" }, id);
    expect(await client.response("c2")).toMatchObject({ ok: false, error: { code: "operationFailed" } });
    expect(client.messages.filter(message => message.type === "event" && message.event === "session.snapshot")).toEqual([]);
  });
  it("settles archiving and then publishes terminal closure and inventory", async () => {
    const archive = vi.spyOn(ProjectSessionService.prototype, "archive").mockResolvedValue(undefined);
    const client = await listen(new FakeRuntimeAdapter());
    client.send("session.archive", "archive", { path: "fake-session.jsonl", archived: true });
    expect(await client.response("archive")).toMatchObject({ ok: true });
    await client.wait(message => message.type === "event" && message.event === "session.list.changed" && message.data.sessions.length === 0);
    expect(archive).toHaveBeenCalledWith("fake-session.jsonl", true);
    expect(client.messages).toContainEqual(expect.objectContaining({ event: "session.closed", data: { reason: "archived" } }));
  });
  it("acknowledges project removal even when later catalogue refresh fails", async () => {
    const remove = vi.spyOn(ProjectSessionService.prototype, "removeProject").mockResolvedValue(undefined);
    const client = await listen(new FakeRuntimeAdapter());
    vi.spyOn(ProjectSessionService.prototype, "catalogue").mockRejectedValue(new Error("scan failed"));

    client.send("project.remove", "remove", { path: process.cwd() });

    expect(await client.response("remove")).toMatchObject({ ok: true, result: { state: "completed" } });
    expect(remove).toHaveBeenCalledWith(process.cwd());
  });
  it.each(["session.create", "session.open"])("returns %s before the post-mutation project scan completes", async method => {
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    const scan = vi.spyOn(ProjectSessionService.prototype, "catalogue").mockResolvedValueOnce({ projects: [] }).mockImplementation(async (_active, options) => {
      if (!options?.checkoutPaths) await gate;
      return { projects: [] };
    });
    vi.spyOn(ProjectSessionService.prototype, "rememberProject").mockResolvedValue(undefined);
    const next = new FakeRuntimeAdapter("next");
    server = await createPiServer({ runtime: new FakeRuntimeAdapter(), runtimeFactory: { continueProject: async () => next, openSession: async () => next, newSession: async () => next } });
    await new Promise<void>(resolve => server.httpServer.listen(0, "127.0.0.1", resolve));
    const client = await v2Socket(server); await client.initialize();
    try {
      client.send(method, "open", method === "session.open" ? { sessionPath: "next.jsonl" } : {});
      const response = await client.response("open"); expect(response).toMatchObject({ ok: true, result: { snapshot: { runtime: { status: "idle" } } } });
      await vi.waitFor(() => expect(scan.mock.calls.filter(([, options]) => !options?.checkoutPaths)).toHaveLength(2));
      expect(scan.mock.calls.some(([, options]) => options?.checkoutPaths?.includes(next.snapshot().projectPath))).toBe(true);
    } finally { release(); }
  });
  it("does not expose optional presentation without capability selection", async () => {
    server = await createPiServer({ runtime: new FakeRuntimeAdapter() }); await new Promise<void>(resolve => server.httpServer.listen(0, "127.0.0.1", resolve));
    const client = await v2Socket(server); const initial = await client.initialize([]);
    expect(initial.snapshots[0]).not.toHaveProperty("presentation");
    client.send("session.snapshot", "snap", {}, initial.snapshots[0]!.sessionId);
    const reply = await client.response("snap"); expect(reply).toMatchObject({ ok: true }); if (reply.ok) expect(reply.result).not.toHaveProperty("presentation");
    client.send("file.open", "file", { path: "anything" }, initial.snapshots[0]!.sessionId);
    expect(await client.response("file")).toMatchObject({ ok: false, error: { code: "unsupportedOperation" } });
  });
  it("recovers the same runtime and completed transcript after reconnect", async () => {
    const client = await listen(new FakeRuntimeAdapter()); const id = client.initial.snapshots[0]!.sessionId;
    client.send("message.send", "prompt", { message: "Hello" }, id);
    await client.wait(message => message.type === "event" && message.event === "operation.finished"); client.socket.terminate();
    const next = await v2Socket(server); const initial = await next.initialize();
    expect(initial.serverInstanceId).toBe(client.initial.serverInstanceId); expect(initial.snapshots[0]!.sessionId).toBe(id);
    expect(initial.snapshots[0]!.messages.map(message => message.role)).toEqual(["user", "assistant"]);
    expect(initial.snapshots[0]!.messages.filter(message => message.role === "assistant" && message.text === "Hello from Pi Chat.")).toHaveLength(1);
    expect(initializeResultSchema.safeParse(initial).success).toBe(true);
  });
  it("logs only connection lifecycle metadata", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), flush: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    server = await createPiServer({ runtime: new FakeRuntimeAdapter(), logger: logger });
    await new Promise<void>(resolve => server.httpServer.listen(0, "127.0.0.1", resolve));
    const client = await v2Socket(server); await client.initialize(); client.socket.close(1000, "test close");
    await vi.waitFor(() => expect(logger.info).toHaveBeenCalledWith("websocket.close", expect.objectContaining({ code: 1000, initialized: true, runtimeActive: false })));
    expect(logger.info).toHaveBeenCalledWith("websocket.open", { connectionId: expect.any(String) });
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('"params"');
  });
});
