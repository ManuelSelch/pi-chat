import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeAdapter, RuntimeAdapterFactory } from "../../../../src/server/runtime/contracts.js";
import { createPiChatServer } from "../../../../src/server/bootstrap/server.js";
import { PiRuntimeAdapter } from "../../../../src/server/runtime/pi/pi-runtime-adapter.js";

const captured = vi.hoisted(() => ({ factories: [] as RuntimeAdapterFactory[] }));
vi.mock("node:http", () => ({ createServer: () => ({ close: (done: () => void) => done() }) }));
vi.mock("../../../../src/server/application/chat-application-service.js", () => ({
  ChatApplicationService: class {
    constructor(_runtime: unknown, factory: RuntimeAdapterFactory) { captured.factories.push(factory); }
    async dispose() {}
  },
}));
vi.mock("../../../../src/server/transport/websocket-transport.js", () => ({
  WebSocketTransport: class { async close() {} },
}));
vi.mock("../../../../src/server/runtime/pi/pi-runtime-adapter.js", () => ({
  PiRuntimeAdapter: { create: vi.fn(), openSession: vi.fn(), newSession: vi.fn() },
}));

beforeEach(() => { captured.factories.length = 0; vi.clearAllMocks(); });

describe("server runtime factory defaults", () => {
  it.each(["omitted", "undefined"])("lazily delegates all default factory methods when %s", async (argument) => {
    const server = argument === "omitted" ? createPiChatServer(undefined) : createPiChatServer(undefined, undefined, undefined);
    try {
      expect(PiRuntimeAdapter.create).not.toHaveBeenCalled();
      expect(PiRuntimeAdapter.openSession).not.toHaveBeenCalled();
      expect(PiRuntimeAdapter.newSession).not.toHaveBeenCalled();
      const factory = captured.factories[0]!;
      const adapter = {} as RuntimeAdapter;
      vi.mocked(PiRuntimeAdapter.create).mockResolvedValue(adapter as PiRuntimeAdapter);
      vi.mocked(PiRuntimeAdapter.openSession).mockResolvedValue(adapter as PiRuntimeAdapter);
      vi.mocked(PiRuntimeAdapter.newSession).mockResolvedValue(adapter as PiRuntimeAdapter);
      await expect(factory.continueProject("/project")).resolves.toBe(adapter);
      await expect(factory.openSession("/session.jsonl")).resolves.toBe(adapter);
      await expect(factory.newSession("/new-project")).resolves.toBe(adapter);
      expect(PiRuntimeAdapter.create).toHaveBeenCalledExactlyOnceWith("/project");
      expect(PiRuntimeAdapter.openSession).toHaveBeenCalledExactlyOnceWith("/session.jsonl");
      expect(PiRuntimeAdapter.newSession).toHaveBeenCalledExactlyOnceWith("/new-project");
    } finally { await server.close(); }
  });

  it("creates independent factory objects and methods for separate servers", async () => {
    const first = createPiChatServer(undefined);
    const second = createPiChatServer(undefined);
    try {
      const [left, right] = captured.factories;
      expect(left).not.toBe(right);
      expect(left!.continueProject).not.toBe(right!.continueProject);
      expect(left!.openSession).not.toBe(right!.openSession);
      expect(left!.newSession).not.toBe(right!.newSession);
    } finally { await Promise.all([first.close(), second.close()]); }
  });

  it("passes a supplied factory through unchanged without calling SDK methods", async () => {
    const factory = { continueProject: vi.fn(), openSession: vi.fn(), newSession: vi.fn() };
    const server = createPiChatServer(undefined, undefined, factory);
    try {
      expect(captured.factories).toEqual([factory]);
      expect(captured.factories[0]).toBe(factory);
      expect(PiRuntimeAdapter.create).not.toHaveBeenCalled();
      expect(PiRuntimeAdapter.openSession).not.toHaveBeenCalled();
      expect(PiRuntimeAdapter.newSession).not.toHaveBeenCalled();
    } finally { await server.close(); }
  });
});
