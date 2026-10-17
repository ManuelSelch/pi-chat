import { createWebSocketTransport, type TransportFactory } from "@manuelselch/pi-sdk";

/** Browser diagnostics only. Connection lifecycle/backoff belong to PiClient. */
export const browserTransport: TransportFactory = (endpoint, handlers) =>
  createWebSocketTransport((url) => new WebSocket(url))(endpoint, {
    ...handlers,
    open() {
      console.info("[pi-chat] websocket.open", { timestamp: new Date().toISOString() });
      handlers.open();
    },
    error(event) {
      console.warn("[pi-chat] websocket.error", { timestamp: new Date().toISOString(), message: event instanceof ErrorEvent ? event.message : undefined });
      handlers.error(event);
    },
    close(event) {
      console.info("[pi-chat] websocket.close", { timestamp: new Date().toISOString(), code: event.code, reason: event.reason,
        wasClean: "wasClean" in event ? event.wasClean : undefined });
      handlers.close(event);
    },
  });
