import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import {
  CONTROLLER_REPLACED_CODE,
  PROTOCOL_VERSION,
  parseClientMessage,
} from "../../shared/protocol.js";
import { ChatApplicationService } from "../application/chat-application-service.js";
import { ServerPublisher } from "./server-publisher.js";
import { handleClientCommand } from "./command-handler.js";
import type { FileLogger } from "../logging/file-logger.js";

export class WebSocketTransport {
  private readonly server: WebSocketServer;
  private controller?: WebSocket;
  private readonly publisher: ServerPublisher;
  private readonly unsubscribe: () => void;

  private readonly connectionIds = new WeakMap<WebSocket, string>();

  constructor(httpServer: Server, private readonly chat: ChatApplicationService, private readonly logger?: FileLogger) {
    this.server = new WebSocketServer({ server: httpServer, path: "/ws" });
    this.publisher = new ServerPublisher(chat, () => this.controller, logger);
    this.unsubscribe = chat.subscribe((sessionId, event) => this.publisher.publish(sessionId, event));
    this.server.on("connection", (socket) => this.connect(socket));
  }

  async close(): Promise<void> {
    this.unsubscribe();
    this.controller?.close();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private connect(socket: WebSocket): void {
    const connectionId = randomUUID();
    this.connectionIds.set(socket, connectionId);
    this.logger?.info("websocket.open", { connectionId });
    if (this.controller?.readyState === WebSocket.OPEN) {
      this.logger?.warn("websocket.controller_replaced", { connectionId: this.connectionIds.get(this.controller) });
      this.publisher.sendTo(this.controller, this.publisher.protocolError("Another browser took control of this Pi Chat session."));
      this.controller.close(CONTROLLER_REPLACED_CODE, "Controller replaced");
    }
    this.controller = socket;
    // A browser is in control again, so pending dialogs stop counting down.
    this.chat.resumePrompts();
    void this.publisher.sendAll(socket);

    socket.on("message", (data) => this.handleMessage(socket, data));

    socket.on("error", (error) => {
      this.logger?.error("websocket.error", { connectionId, message: error.message });
    });

    socket.on("close", (code, reason) => {
      this.logger?.info("websocket.close", {
        connectionId,
        code,
        reason: reason.toString("utf8").slice(0, 256),
        controller: this.controller === socket,
        runtimeActive: this.chat.tabs().some((tab) => tab.status !== "idle"),
      });
      if (this.controller !== socket) return;
      this.controller = undefined;
      // A reload must not cancel a permission gate, so pending dialogs only
      // expire after the registry's grace period without a controller.
      this.chat.suspendPrompts();
    });
  }

  private handleMessage(socket: WebSocket, data: WebSocket.RawData): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      this.publisher.sendTo(socket, this.publisher.protocolError("Message must be valid JSON."));
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
      this.publisher.sendTo(socket, this.publisher.protocolError("Message does not match protocol version 1."));
      return;
    }

    handleClientCommand(socket, result.value, {
      chat: this.chat,
      publisher: this.publisher,
      isController: (candidate) => candidate === this.controller,
      openTab: (open, origin, requestId) => void this.openTab(open, origin, requestId),
    });
  }

  private async openTab(open: () => Promise<string>, socket = this.controller, requestId?: string): Promise<void> {
    let sessionId: string;
    try {
      sessionId = await open();
    } catch (error: unknown) {
      if (requestId && socket) {
        this.publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "sessionOpenError", requestId, error: this.publisher.errorText(error) });
      } else this.publisher.publishError(this.chat.activeSessionId(), error);
      return;
    }
    // Creation succeeded even if a later snapshot/catalogue refresh fails.
    try {
      await this.publisher.sendSnapshot(sessionId);
      this.publisher.sendTabs();
    } catch (error: unknown) {
      this.publisher.publishError(sessionId, error);
    } finally {
      // The session is usable now; catalogue scanning must not delay the Open reply.
      if (requestId && socket) this.publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "sessionOpened", requestId, sessionId });
    }
    await this.publisher.sendCatalogue();
  }

}
