import { expect, it, vi } from "vitest";
import { createWebSocketTransport, type WebSocketLike, type TransportHandlers } from "../src/transport.js";

it("accepts the standard WebSocket constructor structurally without importing it", () => {
  const factory = createWebSocketTransport((endpoint) => new WebSocket(endpoint));
  expect(typeof factory).toBe("function");
});

it("adapts a supplied WebSocket and removes every listener on disposal", () => {
  const events = new Map<string, (event: any) => void>();
  const socket: WebSocketLike = {
    readyState: 1, bufferedAmount: 0, send: vi.fn(), close: vi.fn(),
    addEventListener: (type, listener) => { events.set(type, listener); },
    removeEventListener: (type) => { events.delete(type); },
  };
  const handlers: TransportHandlers = { open: vi.fn(), message: vi.fn(), close: vi.fn(), error: vi.fn() };
  const factory = vi.fn(() => socket);
  const transport = createWebSocketTransport(factory)("wss://example/ws", handlers);
  expect(factory).toHaveBeenCalledWith("wss://example/ws");
  events.get("open")!({}); events.get("message")!({ data: "text" });
  events.get("error")!(new Error("offline")); events.get("close")!({ code: 4001, reason: "replaced" });
  expect(handlers.open).toHaveBeenCalledOnce();
  expect(handlers.message).toHaveBeenCalledWith("text");
  expect(handlers.close).toHaveBeenCalledWith({ code: 4001, reason: "replaced" });
  expect(handlers.error).toHaveBeenCalledOnce();
  transport.send("command"); expect(socket.send).toHaveBeenCalledWith("command");
  transport.dispose(); transport.dispose(); expect(events.size).toBe(0);
  transport.close(); expect(socket.close).toHaveBeenCalledOnce();
});

it("rejects outbound overload before calling the socket send", () => {
  const socket: WebSocketLike = { readyState: 1, bufferedAmount: 9, send: vi.fn(), close: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const handlers = { open: vi.fn(), message: vi.fn(), close: vi.fn(), error: vi.fn() };
  const transport = createWebSocketTransport(() => socket, { maxBufferedBytes: 10 })("ws://example/ws", handlers);
  expect(() => transport.send("🌍")).toThrow(expect.objectContaining({ code: "limitExceeded", outcome: "notSent" }));
  expect(socket.send).not.toHaveBeenCalled();
  transport.dispose();
});
