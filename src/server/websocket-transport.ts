import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import {
  CONTROLLER_REPLACED_CODE,
  PROTOCOL_VERSION,
  parseClientMessage,
  type ServerMessage,
} from "../shared/protocol.js";
import { ChatApplicationService } from "./chat-application-service.js";
import type { RuntimeEvent } from "./runtime-adapter.js";

export class WebSocketTransport {
  private readonly server: WebSocketServer;
  private sequence = 0;
  private controller?: WebSocket;
  private readonly unsubscribe: () => void;

  constructor(httpServer: Server, private readonly chat: ChatApplicationService) {
    this.server = new WebSocketServer({ server: httpServer, path: "/ws" });
    this.unsubscribe = chat.subscribe((event) => this.publish(event));
    this.server.on("connection", (socket) => this.connect(socket));
  }

  async close(): Promise<void> {
    this.unsubscribe();
    this.controller?.close();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private connect(socket: WebSocket): void {
    if (this.controller?.readyState === WebSocket.OPEN) {
      this.sendTo(this.controller, this.protocolError("Another browser took control of this Pi Chat session."));
      this.controller.close(CONTROLLER_REPLACED_CODE, "Controller replaced");
    }
    this.controller = socket;
    const snapshot = this.chat.snapshot();
    this.sendTo(socket, {
      version: PROTOCOL_VERSION,
      type: "snapshot",
      sequence: this.sequence,
      throughSequence: this.sequence,
      ...snapshot,
    });

    socket.on("message", (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        this.sendTo(socket, this.protocolError("Message must be valid JSON."));
        return;
      }

      const result = (() => {
        try {
          return { ok: true as const, value: parseClientMessage(parsed) };
        } catch {
          return { ok: false as const };
        }
      })();
      if (!result.ok) {
        this.sendTo(socket, this.protocolError("Message does not match protocol version 1."));
        return;
      }

      if (result.value.type === "abort") {
        void this.chat.abort().catch((error: unknown) => this.publishError(error));
      } else {
        void this.chat.prompt(result.value.message).catch((error: unknown) => this.publishError(error));
      }
    });

    socket.on("close", () => {
      if (this.controller === socket) this.controller = undefined;
    });
  }

  private publish(event: RuntimeEvent): void {
    const message: ServerMessage = { version: PROTOCOL_VERSION, sequence: ++this.sequence, ...event };
    if (this.controller?.readyState === WebSocket.OPEN) this.sendTo(this.controller, message);
  }

  private publishError(error: unknown): void {
    const text = error instanceof Error ? error.message : "Unknown runtime error";
    this.publish({ type: "runtimeStatus", status: "idle", error: text });
  }

  private protocolError(error: string): ServerMessage {
    return { version: PROTOCOL_VERSION, type: "protocolError", sequence: ++this.sequence, error };
  }

  private sendTo(socket: WebSocket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }
}
