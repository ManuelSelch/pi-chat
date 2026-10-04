import { WebSocket } from "ws";
import { PROTOCOL_VERSION, type ServerMessage } from "../../shared/protocol.js";
import type { RuntimeEvent } from "../runtime/contracts.js";
import type { ChatApplicationService } from "../application/chat-application-service.js";

export class ServerPublisher {
  private readonly sequences = new Map<string, number>();

  constructor(
    private readonly chat: ChatApplicationService,
    private readonly controller: () => WebSocket | undefined,
  ) {}

  publish(sessionId: string, event: RuntimeEvent): void {
    if (event.type === "sessionSwitch") {
      void this.sendSnapshot(sessionId);
      this.sendTabs();
      void this.sendCatalogue();
      return;
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
    for (const sessionId of this.chat.openSessionIds()) await this.sendSnapshot(sessionId, socket);
    this.sendTabs(socket);
    await this.sendCatalogue(socket);
  }

  async sendCatalogue(socket = this.controller()): Promise<void> {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      this.sendTo(socket, { version: PROTOCOL_VERSION, type: "catalogue", catalogue: await this.chat.currentCatalogue(), features: this.chat.appFeatures() });
    } catch (error: unknown) {
      this.publishError(this.chat.activeSessionId(), error);
    }
  }

  sendTabs(socket = this.controller()): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    this.sendTo(socket, { version: PROTOCOL_VERSION, type: "tabs", tabs: this.chat.tabs(), activeSessionId: this.chat.activeSessionId() });
  }

  async sendSnapshot(sessionId: string, socket = this.controller()): Promise<void> {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const sequence = this.sequences.get(sessionId) ?? 0;
    const snapshot = await this.chat.snapshot(sessionId);
    this.sendTo(socket, { version: PROTOCOL_VERSION, type: "snapshot", sequence, throughSequence: sequence, ...snapshot });
  }

  publishError(sessionId: string, error: unknown): void {
    const text = error instanceof Error ? error.message : "Unknown runtime error";
    this.publish(sessionId, { type: "runtimeStatus", status: "idle", error: text });
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
