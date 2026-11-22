import { beforeEach, expect, test, vi } from "vitest";
import { definePlugin } from "@manuelselch/pi-sdk/plugins";
import { createPiServer } from "../../../../src/index.js";

const calls = vi.hoisted(() => ({
  http: vi.fn(() => ({ listening: false })),
  chat: vi.fn(), disposeChat: vi.fn<() => Promise<void>>(),
  transport: vi.fn(), closeTransport: vi.fn<() => Promise<void>>(),
}));
vi.mock("node:http", () => ({ createServer: calls.http }));
vi.mock("../../../../src/application/chat-application-service.js", () => ({
  ChatApplicationService: class {
    constructor() { calls.chat(); }
    dispose() { return calls.disposeChat(); }
  },
}));
vi.mock("../../../../src/transport/websocket-transport.js", () => ({
  WebSocketTransport: class {
    constructor() { calls.transport(); }
    close() { return calls.closeTransport(); }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  calls.transport.mockReset();
  calls.disposeChat.mockResolvedValue(undefined);
  calls.closeTransport.mockResolvedValue(undefined);
});

test("awaits host plugin readiness before constructing a connectable HTTP server", async () => {
  let ready!: () => void;
  let entered!: () => void;
  const enteredSetup = new Promise<void>(resolve => { entered = resolve; });
  const releaseSetup = new Promise<void>(resolve => { ready = resolve; });
  const plugin = definePlugin({ id: "pending", host: async () => ({ async setup() { entered(); await releaseSetup; } }) });
  const pending = createPiServer({ plugins: [plugin] });
  let resolved = false;
  void pending.then(() => { resolved = true; });
  await enteredSetup;

  expect(resolved).toBe(false);
  expect(calls.http).not.toHaveBeenCalled();
  expect(calls.transport).not.toHaveBeenCalled();
  ready();
  const server = await pending;

  expect(calls.http).toHaveBeenCalledTimes(1);
  expect(calls.transport).toHaveBeenCalledTimes(1);
  await server.close();
});

test("plugin service factories cannot use server actions during setup or after close", async () => {
  let services!: import("../../../../src/index.js").ServerPluginServices;
  const server = await createPiServer({ plugins: provided => {
    services = provided;
    return [definePlugin({ id: "service-lifetime", host: async () => ({ async setup() {
      await expect(services.getSession("s")).rejects.toThrow("not ready");
      expect(services).not.toHaveProperty("browseDirectories");
      expect(calls.http).not.toHaveBeenCalled();
      expect(calls.chat).not.toHaveBeenCalled();
    } }) })];
  } });

  await server.close();

  await expect(services.getSession("s")).rejects.toThrow("not ready");
  expect(services).not.toHaveProperty("browseDirectories");
});

test("failed plugin setup rolls back without constructing network or session resources", async () => {
  const cleanup = vi.fn();
  const plugin = definePlugin({ id: "failed", host: async () => ({ setup(ctx) {
    ctx.onCleanup(cleanup);
    throw new Error("Plugin failed");
  } }) });

  await expect(createPiServer({ plugins: [plugin] })).rejects.toThrow("Plugin failed");

  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(calls.http).not.toHaveBeenCalled();
  expect(calls.chat).not.toHaveBeenCalled();
});

test("server close disposes plugin resources once per server instance", async () => {
  const cleanups = [vi.fn(), vi.fn()];
  const signals: { readonly aborted: boolean }[] = [];
  const plugin = definePlugin({ id: "isolated", host: async () => ({ setup(ctx) {
    const index = signals.length;
    signals.push(ctx.signal);
    ctx.onCleanup(cleanups[index]!);
  } }) });
  const first = await createPiServer({ plugins: [plugin] });
  const second = await createPiServer({ plugins: [plugin] });

  await Promise.all([first.close(), first.close()]);

  expect(signals[0]?.aborted).toBe(true);
  expect(signals[1]?.aborted).toBe(false);
  expect(cleanups[0]).toHaveBeenCalledTimes(1);
  expect(cleanups[1]).not.toHaveBeenCalled();
  await second.close();
  expect(cleanups[1]).toHaveBeenCalledTimes(1);
});

test("bootstrap failure disposes already-started plugins and constructed sessions", async () => {
  const cleanup = vi.fn();
  const plugin = definePlugin({ id: "started", host: async () => ({ setup(ctx) { ctx.onCleanup(cleanup); } }) });
  calls.transport.mockImplementationOnce(() => { throw new Error("Transport failed"); });

  await expect(createPiServer({ plugins: [plugin] })).rejects.toThrow("Transport failed");

  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(calls.disposeChat).toHaveBeenCalledTimes(1);
});

test("plugin cleanup failure does not prevent session and transport teardown", async () => {
  const plugin = definePlugin({ id: "cleanup", host: async () => ({ setup(ctx) {
    ctx.onCleanup(() => { throw new Error("Plugin cleanup failed"); });
  } }) });
  const server = await createPiServer({ plugins: [plugin] });

  await expect(server.close()).rejects.toThrow(AggregateError);
  await expect(server.close()).rejects.toThrow(AggregateError);

  expect(calls.disposeChat).toHaveBeenCalledTimes(1);
  expect(calls.closeTransport).toHaveBeenCalledTimes(1);
});

test("transport teardown failure still aborts and disposes host plugins", async () => {
  const cleanup = vi.fn();
  const plugin = definePlugin({ id: "cleanup", host: async () => ({ setup(ctx) { ctx.onCleanup(cleanup); } }) });
  const server = await createPiServer({ plugins: [plugin] });
  calls.closeTransport.mockRejectedValueOnce(new Error("Transport cleanup failed"));

  await expect(server.close()).rejects.toThrow(AggregateError);

  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(calls.disposeChat).toHaveBeenCalledTimes(1);
});
