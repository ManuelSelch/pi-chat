import { WebSocket } from "ws";
import { PROTOCOL_VERSION, type ServerMessage } from "../../shared/protocol.js";
import type { RuntimeEvent } from "../runtime/contracts.js";
import type { ChatApplicationService } from "../application/chat-application-service.js";
import type { FileLogger } from "../logging/file-logger.js";
import { redactRuntimeError } from "./runtime-error-redaction.js";

export class ServerPublisher {
  private readonly sequences = new Map<string, number>();

  constructor(
    private readonly chat: ChatApplicationService,
    private readonly controller: () => WebSocket | undefined,
    private readonly logger?: FileLogger,
  ) {}

  publish(sessionId: string, event: RuntimeEvent): void {
    if (event.type === "sessionSwitch" || event.type === "sessionMetadataChanged") {
      void this.sendSnapshot(sessionId);
      this.sendTabs();
      void this.sendCatalogue();
      return;
    }
    if (event.type === "notification" && event.level === "error") {
      this.logger?.error("runtime.notification_error", { message: redactRuntimeError(event.message) });
    }
    if (event.type === "runtimeStatus" && event.error) {
      this.logger?.error("runtime.turn_error", { message: redactRuntimeError(event.error), status: event.status });
    }
    const message: ServerMessage = {
      version: PROTOCOL_VERSION,
      sessionId,
      sequence: this.nextSequence(sessionId),
      ...event,
    };
    this.send(message);
    if (event.type === "runtimeStatus" || event.type === "prompts") this.sendTabs();
  }

  async sendAll(socket: WebSocket): Promise<void> {
    for (const sessionId of this.chat.openSessionIds()) {
      if (!this.isCurrentSocket(socket)) return;
      await this.sendSnapshot(sessionId, socket);
    }
    if (!this.isCurrentSocket(socket)) return;
    this.sendTabs(socket);
    await this.sendCatalogue(socket);
  }

  async sendCatalogue(socket = this.controller()): Promise<void> {
    if (!this.isCurrentSocket(socket)) return;
    try {
      const catalogue = await this.chat.currentCatalogue();
      if (!this.isCurrentSocket(socket)) return;
      this.sendTo(socket, { version: PROTOCOL_VERSION, type: "catalogue", catalogue, features: this.chat.appFeatures() });
    } catch (error: unknown) {
      if (this.isCurrentSocket(socket)) this.publishError(this.chat.activeSessionId(), error);
    }
  }

  sendTabs(socket = this.controller()): void {
    if (!this.isCurrentSocket(socket)) return;
    this.sendTo(socket, { version: PROTOCOL_VERSION, type: "tabs", tabs: this.chat.tabs(), activeSessionId: this.chat.activeSessionId() });
  }

  async sendSnapshot(sessionId: string, socket = this.controller()): Promise<void> {
    if (!this.isCurrentSocket(socket)) return;
    const capture = await this.chat.prepareSnapshot(sessionId);
    if (!this.isCurrentSocket(socket)) return;
    // No await from capture through send: state and its event watermark belong
    // to the same synchronous publication, even if preparation finished late.
    const snapshot = capture();
    if (!snapshot) return;
    const sequence = this.sequences.get(sessionId) ?? 0;
    this.sendTo(socket, { version: PROTOCOL_VERSION, type: "snapshot", sequence, throughSequence: sequence, ...snapshot });
  }

  publishError(sessionId: string, error: unknown): void {
    const text = error instanceof Error ? error.message : "Unknown runtime error";
    this.logger?.error("runtime.operation_error", {
      errorName: error instanceof Error ? error.name : "NonError",
      message: redactRuntimeError(text),
    });
    // A rejected steering/command submission does not settle the ongoing run.
    const tab = this.chat.tabs().find((entry) => entry.sessionId === sessionId);
    const status = tab && tab.status !== "idle" ? "running" : "idle";
    this.publish(sessionId, { type: "runtimeStatus", status, error: text });
  }

  replyTo(socket: WebSocket, message: ServerMessage): void {
    if (socket === this.controller() && socket.readyState === WebSocket.OPEN) this.sendTo(socket, message);
  }

  errorText(error: unknown): string {
    return error instanceof Error ? error.message : "Unable to open this server folder.";
  }

  protocolError(error: string): ServerMessage {
    return { version: PROTOCOL_VERSION, type: "protocolError", error };
  }

  sendTo(socket: WebSocket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }

  private isCurrentSocket(socket: WebSocket | undefined): socket is WebSocket {
    return socket !== undefined && socket === this.controller() && socket.readyState === WebSocket.OPEN;
  }

  private nextSequence(sessionId: string): number {
    const next = (this.sequences.get(sessionId) ?? 0) + 1;
    this.sequences.set(sessionId, next);
    return next;
  }

  private send(message: ServerMessage): void {
    const socket = this.controller();
    if (socket?.readyState === WebSocket.OPEN) this.sendTo(socket, message);
  }
}
