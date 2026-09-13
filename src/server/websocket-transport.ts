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
    // A browser is in control again, so pending dialogs stop counting down.
    this.chat.resumePrompts();
    void this.sendSnapshot(socket);

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
      } else if (result.value.type === "prompt") {
        // A prompt can be a native command such as /model, which changes state
        // the snapshot owns, so refresh once the run settles.
        void this.chat
          .prompt(result.value.message)
          .then(() => this.sendSnapshot())
          .catch((error: unknown) => this.publishError(error));
      } else if (result.value.type === "uiPromptResponse") {
        this.chat.respondToPrompt(result.value.promptId, result.value.result);
      } else if (result.value.type === "runFeature") {
        void this.chat.runFeature(result.value).then(() => this.sendSnapshot()).catch((error: unknown) => this.publishError(error));
      } else if (result.value.type === "openProject") {
        void this.chat.openProject(result.value.path).then(() => this.sendSnapshot()).catch((error: unknown) => this.publishError(error));
      } else if (result.value.type === "openSession") {
        void this.chat.openSession(result.value.path).then(() => this.sendSnapshot()).catch((error: unknown) => this.publishError(error));
      } else {
        void this.chat.newSession(result.value.path).then(() => this.sendSnapshot()).catch((error: unknown) => this.publishError(error));
      }
    });

    socket.on("close", () => {
      if (this.controller !== socket) return;
      this.controller = undefined;
      // A reload must not cancel a permission gate, so pending dialogs only
      // expire after the registry's grace period without a controller.
      this.chat.suspendPrompts();
    });
  }

  private publish(event: RuntimeEvent): void {
    const message: ServerMessage = { version: PROTOCOL_VERSION, sequence: ++this.sequence, ...event };
    if (this.controller?.readyState === WebSocket.OPEN) this.sendTo(this.controller, message);
  }

  private async sendSnapshot(socket = this.controller): Promise<void> {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const snapshot = await this.chat.snapshot();
    this.sendTo(socket, {
      version: PROTOCOL_VERSION,
      type: "snapshot",
      sequence: this.sequence,
      throughSequence: this.sequence,
      ...snapshot,
    });
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
