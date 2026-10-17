import { expect, it, vi } from "vitest";
import { createWebSocketTransport, type WebSocketLike, type TransportHandlers } from "../src/transport.js";

it("adapts a supplied WebSocket and removes every listener on disposal", () => {
  const events = new Map<string, (event: any) => void>();
  const socket: WebSocketLike = {
    readyState: 1, send: vi.fn(), close: vi.fn(),
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
