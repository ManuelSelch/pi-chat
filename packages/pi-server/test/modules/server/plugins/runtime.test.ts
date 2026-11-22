import { beforeEach, expect, expectTypeOf, test, vi } from "vitest";
import {
  definePlugin, defineRemoteContract,
  type HostPluginContext, type HostPluginEntry, type Plugin,
} from "@manuelselch/pi-sdk/plugins";
import { createPluginRuntime } from "../../../../src/plugins/runtime.js";

const text = {
  parse(value: unknown): string {
    if (typeof value !== "string") throw new Error("Expected text");
    return value;
  },
};
const greeting = defineRemoteContract({ id: "greeting", version: 1, methods: { hello: { input: text, output: text } } });
let handler: ReturnType<typeof vi.fn<(name: string) => string>>;
let cleanup: ReturnType<typeof vi.fn<() => void>>;
let context: HostPluginContext;
let plugin: Plugin;

function host(setup: HostPluginEntry["setup"], id = "greeting", provides = [greeting]): Plugin {
  return definePlugin({ id, provides, host: async () => ({ setup }) });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  handler = vi.fn((name: string) => `Hello ${name}`);
  cleanup = vi.fn();
  plugin = host(ctx => {
    context = ctx;
    ctx.onCleanup(cleanup);
    ctx.provide(greeting, { hello: handler });
  });
});

test("starts once and provides a typed validated local client", async () => {
  const load = vi.fn(plugin.host!);
  const runtime = createPluginRuntime([{ ...plugin, host: load }]);
  const client = runtime.client(greeting);

  await expect(client.hello("Ada")).rejects.toThrow("not active");
  await Promise.all([runtime.start(), runtime.start()]);

  expectTypeOf(client.hello).parameter(0).toEqualTypeOf<string>();
  expectTypeOf(client.hello).returns.resolves.toEqualTypeOf<string>();
  await expect(client.hello("Ada")).resolves.toBe("Hello Ada");
  expect(load).toHaveBeenCalledTimes(1);
  await runtime.dispose();
});

test("activates a synchronous host loader and cleans up normally", async () => {
  const setup = vi.fn((ctx: HostPluginContext) => {
    ctx.provide(greeting, { hello: handler });
    ctx.onCleanup(cleanup);
  });
  const load = vi.fn(() => ({ setup }));
  const runtime = createPluginRuntime([definePlugin({ id: "greeting", provides: [greeting], host: load })]);

  expect(load).not.toHaveBeenCalled();
  await runtime.start();

  await expect(runtime.client(greeting).hello("Ada")).resolves.toBe("Hello Ada");
  expect(load).toHaveBeenCalledOnce();
  expect(setup).toHaveBeenCalledOnce();

  await runtime.dispose();

  expect(cleanup).toHaveBeenCalledOnce();
});

test("rejects duplicate plugin IDs before loading any entry", () => {
  const load = vi.fn(plugin.host!);

  expect(() => createPluginRuntime([{ ...plugin, host: load }, plugin])).toThrow("Duplicate plugin");
  expect(load).not.toHaveBeenCalled();
});

test("starts host entries sequentially and does not load web entries", async () => {
  const order: string[] = [];
  const web = vi.fn(async () => ({
    Provider: ({ children }: { children: unknown }) => children,
    commands: [],
    Overlay: () => null,
    useOverlayOpen: () => false,
  }));
  const first = host(async () => { order.push("first"); await Promise.resolve(); order.push("first ready"); }, "first", []);
  const second = host(() => { order.push("second"); }, "second", []);
  const runtime = createPluginRuntime([first, definePlugin({ id: "web-only", web }), second]);

  await runtime.start();

  expect(order).toEqual(["first", "first ready", "second"]);
  expect(web).not.toHaveBeenCalled();
  await runtime.dispose();
});

test("does not invoke a handler for invalid input", async () => {
  const runtime = createPluginRuntime([plugin]);
  await runtime.start();

  // @ts-expect-error Runtime validation protects untyped callers too.
  await expect(runtime.client(greeting).hello(42)).rejects.toThrow("Expected text");
  expect(handler).not.toHaveBeenCalled();
  await runtime.dispose();
});

test("rejects invalid handler output", async () => {
  // @ts-expect-error Exercise runtime output validation beyond the TypeScript boundary.
  const invalid = host(ctx => ctx.provide(greeting, { hello: () => 42 }));
  const runtime = createPluginRuntime([invalid]);
  await runtime.start();

  await expect(runtime.client(greeting).hello("Ada")).rejects.toThrow("Expected text");
  await runtime.dispose();
});

test("rejects missing providers and mismatched contract versions", async () => {
  const runtime = createPluginRuntime([plugin]);
  await runtime.start();
  const missing = defineRemoteContract({ ...greeting, id: "missing" });
  const incompatible = defineRemoteContract({ ...greeting, version: 2 });

  await expect(runtime.client(missing).hello("Ada")).rejects.toThrow("unavailable");
  await expect(runtime.client(incompatible).hello("Ada")).rejects.toThrow("version");
  expect(handler).not.toHaveBeenCalled();
  await runtime.dispose();
});

test("requires an exact declared contract before providing it", async () => {
  const incompatible = defineRemoteContract({ ...greeting, version: 2 });
  const runtime = createPluginRuntime([host(ctx => ctx.provide(incompatible, { hello: handler }))]);

  await expect(runtime.start()).rejects.toThrow("not declared");
  await runtime.dispose();
});

test("rejects duplicate providers and cleans up partial activation", async () => {
  const runtime = createPluginRuntime([host(ctx => {
    context = ctx;
    ctx.onCleanup(cleanup);
    ctx.provide(greeting, { hello: handler });
    ctx.provide(greeting, { hello: handler });
  })]);

  await expect(runtime.start()).rejects.toThrow("Duplicate provider");

  expect(context.signal.aborted).toBe(true);
  expect(cleanup).toHaveBeenCalledTimes(1);
  await expect(runtime.client(greeting).hello("Ada")).rejects.toThrow("not active");
  await runtime.dispose();
  expect(cleanup).toHaveBeenCalledTimes(1);
});

test("validates complete implementations before publishing a provider", async () => {
  // @ts-expect-error JavaScript callers can supply incomplete implementations.
  const invalid = host(ctx => ctx.provide(greeting, {}));
  const runtime = createPluginRuntime([invalid]);

  await expect(runtime.start()).rejects.toThrow("hello");
  await runtime.dispose();
});

test("rolls back earlier plugins and the failing plugin in reverse cleanup order", async () => {
  const order: string[] = [];
  const first = host(ctx => {
    ctx.onCleanup(() => { order.push("first"); });
    ctx.provide(greeting, { hello: handler });
  });
  const second = host(ctx => {
    ctx.onCleanup(() => { order.push("second a"); });
    ctx.onCleanup(() => { order.push("second b"); });
    throw new Error("Setup failed");
  }, "second", []);
  const runtime = createPluginRuntime([first, second]);

  await expect(runtime.start()).rejects.toThrow("Setup failed");

  expect(order).toEqual(["second b", "second a", "first"]);
  await expect(runtime.client(greeting).hello("Ada")).rejects.toThrow("not active");
  await expect(runtime.start()).rejects.toThrow("cannot start");
  await runtime.dispose();
});

test("disposal aborts and withdraws providers before asynchronous cleanup completes", async () => {
  const release = deferred();
  const runtime = createPluginRuntime([host(ctx => {
    context = ctx;
    ctx.provide(greeting, { hello: handler });
    ctx.onCleanup(() => release.promise);
  })]);
  await runtime.start();

  const disposing = runtime.dispose();

  expect(context.signal.aborted).toBe(true);
  await expect(runtime.client(greeting).hello("Ada")).rejects.toThrow("not active");
  release.resolve();
  await disposing;
  await expect(runtime.start()).rejects.toThrow("cannot start");
});

test("runs all cleanups once even when one fails", async () => {
  const runtime = createPluginRuntime([host(ctx => {
    ctx.onCleanup(cleanup);
    ctx.onCleanup(() => { throw new Error("Cleanup failed"); });
  })]);
  await runtime.start();

  await expect(runtime.dispose()).rejects.toThrow(AggregateError);
  await expect(runtime.dispose()).rejects.toThrow(AggregateError);

  expect(cleanup).toHaveBeenCalledTimes(1);
});

test("rejects late provider and cleanup registrations after disposal", async () => {
  const runtime = createPluginRuntime([plugin]);
  await runtime.start();
  await runtime.dispose();

  expect(() => context.provide(greeting, { hello: handler })).toThrow("ended");
  expect(() => context.onCleanup(cleanup)).toThrow("ended");
});

test("aborts a startup in progress without loading the next plugin", async () => {
  const entered = deferred();
  const release = deferred();
  const loadNext = vi.fn(async () => ({ setup() {} }));
  const first = host(async ctx => {
    context = ctx;
    ctx.onCleanup(cleanup);
    entered.resolve();
    await release.promise;
  });
  const next = definePlugin({ id: "next", host: loadNext });
  const runtime = createPluginRuntime([first, next]);
  const started = runtime.start();
  const failed = expect(started).rejects.toThrow("aborted");
  await entered.promise;

  const disposed = runtime.dispose();
  expect(context.signal.aborted).toBe(true);
  release.resolve();
  await Promise.all([failed, disposed]);

  expect(loadNext).not.toHaveBeenCalled();
  expect(cleanup).toHaveBeenCalledTimes(1);
});

test("rejects a result that finishes after its provider was disposed", async () => {
  const release = deferred();
  const runtime = createPluginRuntime([host(ctx => ctx.provide(greeting, {
    hello: async () => { await release.promise; return "late"; },
  }))]);
  await runtime.start();
  const result = runtime.client(greeting).hello("Ada");

  await runtime.dispose();
  release.resolve();

  await expect(result).rejects.toThrow("unavailable");
});

test("disposal before the startup microtask prevents activation", async () => {
  const load = vi.fn(plugin.host!);
  const runtime = createPluginRuntime([{ ...plugin, host: load }]);
  const starting = runtime.start();
  const aborted = expect(starting).rejects.toThrow("aborted");

  await Promise.all([aborted, runtime.dispose()]);

  expect(load).not.toHaveBeenCalled();
  await expect(runtime.start()).rejects.toThrow("cannot start");
});

test("disposal wins over startup even with an empty plugin list", async () => {
  const runtime = createPluginRuntime([]);
  const starting = runtime.start();
  const aborted = expect(starting).rejects.toThrow("aborted");

  await Promise.all([aborted, runtime.dispose()]);
});

test("checks required contract availability after every host has loaded", async () => {
  const consumer = definePlugin({ id: "consumer", requires: [greeting], host: async () => ({ setup() {} }) });
  const runtime = createPluginRuntime([consumer, plugin]);

  await runtime.start();

  await expect(runtime.client(greeting).hello("Ada")).resolves.toBe("Hello Ada");
  await runtime.dispose();
});

test("missing required contracts fail startup and clean up activations", async () => {
  const consumer = definePlugin({
    id: "consumer", requires: [greeting],
    host: async () => ({ setup(ctx) { ctx.onCleanup(cleanup); } }),
  });
  const runtime = createPluginRuntime([consumer]);

  await expect(runtime.start()).rejects.toThrow("Required contract unavailable");

  expect(cleanup).toHaveBeenCalledTimes(1);
  await runtime.dispose();
});

test("required contract versions must match exactly", async () => {
  const consumer = definePlugin({
    id: "consumer", requires: [defineRemoteContract({ ...greeting, version: 2 })],
    host: async () => ({ setup() {} }),
  });
  const runtime = createPluginRuntime([plugin, consumer]);

  await expect(runtime.start()).rejects.toThrow("Required contract unavailable");

  expect(cleanup).toHaveBeenCalledTimes(1);
  await runtime.dispose();
});

test("rejects conflicting providers across overlapping plugin namespaces", async () => {
  const nested = defineRemoteContract({ ...greeting, id: "greeting.nested" });
  const setup = (ctx: HostPluginContext) => ctx.provide(nested, { hello: handler });
  const first = definePlugin({ id: "greeting", provides: [nested], host: async () => ({ setup }) });
  const second = definePlugin({ id: "greeting.nested", provides: [nested], host: async () => ({ setup }) });
  const runtime = createPluginRuntime([first, second]);

  await expect(runtime.start()).rejects.toThrow("Duplicate provider");
  await runtime.dispose();
});

test("preserves startup and cleanup failures while releasing earlier resources", async () => {
  const runtime = createPluginRuntime([host(ctx => {
    ctx.onCleanup(cleanup);
    ctx.onCleanup(() => { throw new Error("Release failed"); });
    throw new Error("Setup failed");
  })]);

  const error = await runtime.start().catch((failure: unknown) => failure);

  expect(error).toBeInstanceOf(AggregateError);
  expect((error as AggregateError).errors[0]).toMatchObject({ message: "Setup failed" });
  expect((error as AggregateError).errors[1]).toBeInstanceOf(AggregateError);
  expect(cleanup).toHaveBeenCalledTimes(1);
  await expect(runtime.dispose()).rejects.toThrow("Plugin cleanup failed");
});

test("cleans up earlier activations when loading the next entry fails", async () => {
  const broken = definePlugin({ id: "broken", host: async () => { throw new Error("Load failed"); } });
  const runtime = createPluginRuntime([plugin, broken]);

  await expect(runtime.start()).rejects.toThrow("Load failed");

  expect(context.signal.aborted).toBe(true);
  expect(cleanup).toHaveBeenCalledTimes(1);
  await runtime.dispose();
});

test("does not set up an entry that finishes loading after disposal", async () => {
  const entered = deferred();
  const release = deferred();
  const setup = vi.fn();
  const loading = definePlugin({ id: "loading", host: async () => {
    entered.resolve();
    await release.promise;
    return { setup };
  } });
  const runtime = createPluginRuntime([loading]);
  const aborted = expect(runtime.start()).rejects.toThrow("aborted");
  await entered.promise;

  const disposed = runtime.dispose();
  release.resolve();
  await Promise.all([aborted, disposed]);

  expect(setup).not.toHaveBeenCalled();
});

test("disposes an idle runtime without loading plugins", async () => {
  const load = vi.fn(plugin.host!);
  const runtime = createPluginRuntime([{ ...plugin, host: load }]);

  await Promise.all([runtime.dispose(), runtime.dispose()]);

  expect(load).not.toHaveBeenCalled();
  await expect(runtime.start()).rejects.toThrow("cannot start");
});

test("keeps separate runtime instances isolated", async () => {
  const first = createPluginRuntime([plugin]);
  const second = createPluginRuntime([]);
  await Promise.all([first.start(), second.start()]);

  await expect(second.client(greeting).hello("Ada")).rejects.toThrow("unavailable");
  await first.dispose();
  await second.dispose();
});
