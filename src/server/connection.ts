import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";

export type PiChatConnectionMode = "single-controller" | "multi-connection";

export interface PiChatConnectionRequest {
  url: string;
  query: Record<string, string>;
  headers: IncomingMessage["headers"];
  remoteAddress?: string;
}

export interface PiChatConnection {
  id: string;
  socket: WebSocket;
  mode: PiChatConnectionMode;
  request: PiChatConnectionRequest;
  metadata: Record<string, unknown>;
}

let nextConnection = 0;

export function connectionRequestFrom(request: Pick<IncomingMessage, "url" | "headers"> & { socket: { remoteAddress?: string } }): PiChatConnectionRequest {
  const url = request.url ?? "/";
  const parsed = new URL(url, `http://${request.headers.host ?? "127.0.0.1"}`);
  return {
    url,
    query: Object.fromEntries(parsed.searchParams.entries()),
    headers: request.headers,
    ...(request.socket.remoteAddress ? { remoteAddress: request.socket.remoteAddress } : {}),
  };
}

export function createConnection(socket: WebSocket, mode: PiChatConnectionMode, request: PiChatConnectionRequest): PiChatConnection {
  nextConnection += 1;
  return { id: `connection-${nextConnection}`, socket, mode, request, metadata: {} };
}
