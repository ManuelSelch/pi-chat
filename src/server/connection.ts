import type { WebSocket } from "ws";

export type PiChatConnectionMode = "single-controller" | "multi-connection";

export interface PiChatConnection {
  id: string;
  socket: WebSocket;
  mode: PiChatConnectionMode;
  metadata: Record<string, unknown>;
}

let nextConnection = 0;

export function createConnection(socket: WebSocket, mode: PiChatConnectionMode): PiChatConnection {
  nextConnection += 1;
  return { id: `connection-${nextConnection}`, socket, mode, metadata: {} };
}
