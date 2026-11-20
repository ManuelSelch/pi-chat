import { afterEach, beforeEach, expect, expectTypeOf, test, vi } from "vitest";
import { z } from "zod";
import { PiClient } from "../../src/client.js";
import { defineRemoteContract } from "../../src/plugins/index.js";
import { fakeTransport, type FakeSocket } from "../fake-transport.js";
import { initialized } from "../v2-fixtures.js";

const counterContract = defineRemoteContract({
  id: "test-counter", version: 1,
  methods: { increment: { input: z.null(), output: z.number().int().nonnegative() } },
});
let client: PiClient;
let socket: FakeSocket;
let transport: ReturnType<typeof fakeTransport>;

beforeEach(() => {
  vi.useFakeTimers();
  transport = fakeTransport();
  client = new PiClient({ endpoint: "ws://example/ws", transport: transport.factory });
  client.start();
  vi.advanceTimersByTime(0);
  socket = transport.sockets[0]!;
  socket.open();
  socket.message({
    version: 2, type: "response", requestId: JSON.parse(socket.sent[0]!).requestId, ok: true,
    result: { ...initialized([]), capabilities: ["plugin.call"] },
  });
});

afterEach(() => { client.dispose(); vi.useRealTimers(); });

function reply(value: unknown, requestId = JSON.parse(socket.sent.at(-1)!).requestId) {
  socket.message({ version: 2, type: "response", requestId, ok: true, result: { value } });
}

test("typed plugin calls reuse and correlate the existing connection", async () => {
  const counter = client.plugin(counterContract);
  expectTypeOf(counter.increment).parameter(0).toEqualTypeOf<null>();
  expectTypeOf(counter.increment).returns.resolves.toEqualTypeOf<number>();

  const first = counter.increment(null);
  const firstRequest = JSON.parse(socket.sent.at(-1)!);
  const second = counter.increment(null);
  const secondRequest = JSON.parse(socket.sent.at(-1)!);

  expect(firstRequest).toMatchObject({
    method: "plugin.call", params: { contractId: "test-counter", contractVersion: 1, method: "increment", input: null },
  });
  expect(firstRequest).not.toHaveProperty("sessionId");
  reply(2, secondRequest.requestId);
  reply(1, firstRequest.requestId);

  await expect(first).resolves.toBe(1);
  await expect(second).resolves.toBe(2);
});

test("invalid input is rejected before sending", async () => {
  const counter = client.plugin(counterContract);

  // @ts-expect-error Runtime validation also protects untyped callers.
  await expect(counter.increment(1)).rejects.toMatchObject({ code: "invalidRequest", outcome: "notSent" });

  expect(socket.sent).toHaveLength(1);
});

test("validates plugin-specific output", async () => {
  const result = client.plugin(counterContract).increment(null);
  reply(-1);

  await expect(result).rejects.toMatchObject({ code: "invalidMessage", outcome: "unknown" });
});

test("preserves structured remote errors", async () => {
  const result = client.plugin(counterContract).increment(null);
  socket.message({
    version: 2, type: "response", requestId: JSON.parse(socket.sent.at(-1)!).requestId, ok: false,
    error: { code: "contractUnavailable", message: "Contract is not exposed." },
  });

  await expect(result).rejects.toMatchObject({ code: "contractUnavailable", outcome: "rejected" });
});

test.each(["disconnect", "stop", "dispose", "timeout"] as const)("rejects pending plugin calls on %s without replay", async action => {
  const result = client.plugin(counterContract).increment(null);
  const rejected = expect(result).rejects.toMatchObject({ outcome: "unknown" });

  if (action === "disconnect") socket.end();
  else if (action === "stop") client.stop();
  else if (action === "dispose") client.dispose();
  else vi.advanceTimersByTime(10_000);

  await rejected;
  expect(socket.sent).toHaveLength(2);
  if (action === "disconnect") {
    vi.advanceTimersByTime(250);
    const next = transport.sockets[1]!;
    next.open();
    expect(next.sent.map(text => JSON.parse(text).method)).toEqual(["server.initialize"]);
  }
});

test("rejects non-JSON input even when a local contract accepts it", async () => {
  const local = defineRemoteContract({
    id: "local-only", version: 1,
    methods: { run: { input: { parse: (value: unknown) => value }, output: z.null() } },
  });

  await expect(client.plugin(local).run(undefined)).rejects.toMatchObject({ code: "invalidRequest", outcome: "notSent" });
  expect(socket.sent).toHaveLength(1);
});

test("rejects calls through a retained plugin client after disposal", async () => {
  const counter = client.plugin(counterContract);
  client.dispose();

  await expect(counter.increment(null)).rejects.toMatchObject({ code: "disposed", outcome: "notSent" });
});
