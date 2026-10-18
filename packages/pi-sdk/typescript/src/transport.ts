import { SDKError } from "./errors.js";

export interface TransportHandlers {
  open(): void;
  message(text: string): void;
  close(event: { code: number; reason?: string }): void;
  error(error?: unknown): void;
}
export interface Transport {
  send(text: string): void;
  close(): void;
  /** Detach all listeners; must be safe after close. */
  dispose(): void;
}
/** Return a fresh connection each time; never replay sent data. */
export type TransportFactory = (endpoint: string, handlers: TransportHandlers) => Transport;

interface SocketEvents {
  open: unknown;
  message: { data: unknown };
  close: { code: number; reason: string };
  error: unknown;
}
/** Structural WebSocket subset, satisfied by standard browser/Node WebSocket. */
export interface WebSocketLike {
  readonly readyState: number;
  readonly bufferedAmount: number;
  send(text: string): void;
  close(): void;
  addEventListener<K extends keyof SocketEvents>(type: K, listener: (event: SocketEvents[K]) => void): void;
  removeEventListener<K extends keyof SocketEvents>(type: K, listener: (event: SocketEvents[K]) => void): void;
}

/** No global WebSocket lookup: the application supplies its own constructor. */
export function createWebSocketTransport(createSocket: (endpoint: string) => WebSocketLike, options: { maxBufferedBytes?: number } = {}): TransportFactory {
  const maxBufferedBytes = options.maxBufferedBytes ?? 4_194_304;
  if (!Number.isSafeInteger(maxBufferedBytes) || maxBufferedBytes <= 0) throw new SDKError("invalidRequest", "maxBufferedBytes must be a positive safe integer.");
  return (endpoint, handlers) => {
    const socket = createSocket(endpoint);
    const open = () => handlers.open();
    const message = (event: SocketEvents["message"]) => {
      if (typeof event.data !== "string") { handlers.message(""); return; }
      handlers.message(event.data);
    };
    const close = (event: SocketEvents["close"]) => handlers.close(event);
    const error = (event: unknown) => handlers.error(event);
    socket.addEventListener("open", open);
    socket.addEventListener("message", message);
    socket.addEventListener("close", close);
    socket.addEventListener("error", error);
    return {
      send(text) {
        if (socket.readyState !== 1) throw new SDKError("notConnected", "WebSocket is not open.");
        let bytes = 0;
        for (const character of text) {
          const code = character.codePointAt(0)!;
          bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
        }
        if (socket.bufferedAmount + bytes > maxBufferedBytes) throw new SDKError("limitExceeded", "WebSocket send buffer is full. No request was sent.");
        socket.send(text);
      },
      close: () => socket.close(),
      dispose() {
        socket.removeEventListener("open", open);
        socket.removeEventListener("message", message);
        socket.removeEventListener("close", close);
        socket.removeEventListener("error", error);
      },
    };
  };
}
