import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { definePlugin, defineRemoteContract } from "@manuelselch/pi-sdk/plugins";
import { z } from "zod";
import { createPluginRuntime, type PluginRuntime } from "../../../../src/plugins.js";
import { PluginRpc } from "../../../../src/transport/plugin-rpc.js";
import { V2OperationError } from "../../../../src/transport/v2-connection.js";

const contract = defineRemoteContract({
  id: "private-demo", version: 1,
  methods: { read: { input: z.null(), output: z.number().int().nonnegative() } },
});
const params = { contractId: contract.id, contractVersion: 1, method: "read", input: null };
let runtime: PluginRuntime;
let rpc: PluginRpc;
let handler: ReturnType<typeof vi.fn<() => number>>;

beforeEach(async () => {
  handler = vi.fn(() => 0);
  runtime = createPluginRuntime([definePlugin({
    id: contract.id, provides: [contract],
    host: async () => ({ setup(ctx) { ctx.provide(contract, { read: handler }); } }),
  })]);
  await runtime.start();
  rpc = new PluginRpc(runtime, [contract]);
});
afterEach(async () => { await runtime.dispose(); });

test("does not expose active contracts absent from the allowlist", async () => {
  const privateRpc = new PluginRpc(runtime, []);

  await expect(privateRpc.call(params)).rejects.toMatchObject({ code: "contractUnavailable" });
  expect(handler).not.toHaveBeenCalled();
});

test("provider validators reject invalid input before invoking the handler", async () => {
  await expect(rpc.call({ ...params, input: 1 })).rejects.toMatchObject({ code: "operationFailed", message: "Plugin call failed." });
  expect(handler).not.toHaveBeenCalled();
});

test("provider validators reject invalid output", async () => {
  handler.mockReturnValue(-1);

  await expect(rpc.call(params)).rejects.toMatchObject({ code: "operationFailed", message: "Plugin call failed." });
});

test("sanitizes even transport-shaped errors thrown by plugin handlers", async () => {
  handler.mockImplementation(() => { throw new V2OperationError("privateCode", "/secret/path", { secret: true }); });

  const error = await rpc.call(params).catch(error => error);

  expect(error.toWire()).toEqual({ code: "operationFailed", message: "Plugin call failed." });
});

test("disposed runtime calls cannot invoke the handler", async () => {
  await runtime.dispose();

  await expect(rpc.call(params)).rejects.toMatchObject({ code: "operationFailed" });
  expect(handler).not.toHaveBeenCalled();
});

test("rejects duplicate exposed contract IDs", () => {
  expect(() => new PluginRpc(runtime, [contract, contract])).toThrow("Duplicate RPC contract");
});

test("rejects non-JSON handler results even when a local contract accepts them", async () => {
  const loose = defineRemoteContract({
    id: "local-only", version: 1,
    methods: { read: { input: z.null(), output: { parse: (value: unknown) => value } } },
  });
  const local = createPluginRuntime([definePlugin({
    id: loose.id, provides: [loose],
    host: async () => ({ setup(ctx) { ctx.provide(loose, { read: () => undefined }); } }),
  })]);
  try {
    await local.start();
    const remote = new PluginRpc(local, [loose]);

    await expect(remote.call({ ...params, contractId: loose.id })).rejects.toMatchObject({ code: "operationFailed" });
  } finally {
    await local.dispose();
  }
});
