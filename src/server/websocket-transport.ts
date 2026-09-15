import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import {
  CONTROLLER_REPLACED_CODE,
  PROTOCOL_VERSION,
  parseClientMessage,
  type ServerMessage,
} from "../shared/protocol.js";
import { ChatApplicationService } from "./chat-application-service.js";
import { connectionRequestFrom, createConnection, type PiChatConnection } from "./connection.js";
import type { RuntimeEvent } from "./runtime-adapter.js";

export class WebSocketTransport {
  private readonly server: WebSocketServer;
  /** Per session: a busy tab must not advance a quiet tab's sequence. */
  private readonly sequences = new Map<string, number>();
  private readonly connections = new Map<string, PiChatConnection>();
  private controllerId?: string;
  private readonly unsubscribe: () => void;

  constructor(httpServer: Server, private readonly chat: ChatApplicationService) {
    this.server = new WebSocketServer({ server: httpServer, path: "/ws" });
    this.unsubscribe = chat.subscribe((sessionId, event) => this.publish(sessionId, event));
    this.server.on("connection", (socket, request) => this.connect(socket, request));
  }

  async close(): Promise<void> {
    this.unsubscribe();
    for (const connection of this.connections.values()) connection.socket.close();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private connect(socket: WebSocket, request: import("node:http").IncomingMessage): void {
    const mode = this.chat.connectionMode();
    const connection = createConnection(socket, mode, connectionRequestFrom(request));
    const previous = this.controller();
    if (mode === "single-controller" && previous?.socket.readyState === WebSocket.OPEN) {
      this.sendTo(previous.socket, this.protocolError("Another browser took control of this Pi Chat session."));
      previous.socket.close(CONTROLLER_REPLACED_CODE, "Controller replaced");
    }
    this.connections.set(connection.id, connection);
    if (mode === "single-controller" || !this.controllerId) this.controllerId = connection.id;
    // A browser is in control again, so pending dialogs stop counting down.
    this.chat.resumePrompts();
    void this.chat
      .authorizeConnectionAction("connection.authorize", { connectionId: connection.id, request: connection.request })
      .then(() => this.chat.connectionOpened(connection.id))
      .then(() => this.sendAll(connection.socket))
      .catch((error: unknown) => {
        this.sendTo(connection.socket, this.protocolError(error instanceof Error ? error.message : "Connection rejected."));
        connection.socket.close();
      });

    socket.on("message", (data) => this.handleMessage(connection, data));

    socket.on("close", () => {
      this.connections.delete(connection.id);
      void this.chat.connectionClosed(connection.id);
      if (this.controllerId !== connection.id) return;
      this.controllerId = this.connections.keys().next().value;
      // A reload must not cancel a permission gate, so pending dialogs only
      // expire after the registry's grace period without a controller.
      this.chat.suspendPrompts();
    });
  }

  private handleMessage(connection: PiChatConnection, data: WebSocket.RawData): void {
    const socket = connection.socket;
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

    const command = result.value;
    if (command.type === "abort") {
      void this.chat.authorizeConnectionAction("abort.authorize", { connectionId: connection.id, sessionId: command.sessionId })
        .then(() => this.chat.abort(command.sessionId))
        .catch((error: unknown) => this.publishError(command.sessionId, error));
    } else if (command.type === "prompt") {
      // A prompt can be a native command such as /model, which changes state
      // the snapshot owns, so refresh once the run settles.
      void this.chat
        .authorizeConnectionAction("prompt.authorize", { connectionId: connection.id, sessionId: command.sessionId })
        .then(() => this.chat.prompt(command.sessionId, command.message))
        .then(() => this.sendSnapshot(command.sessionId))
        .catch((error: unknown) => this.publishError(command.sessionId, error));
    } else if (command.type === "uiPromptResponse") {
      this.chat.respondToPrompt(command.sessionId, command.promptId, command.result);
    } else if (command.type === "runFeature" || command.type === "runExtensionAction") {
      const actionId = command.type === "runExtensionAction" ? command.actionId : command.featureId;
      void this.chat
        .authorizeConnectionAction("action.authorize", { connectionId: connection.id, sessionId: command.sessionId, actionId })
        .then(() => this.chat.runFeature(command, connection.id))
        // Renaming changes the tab label too, so the tab list must follow.
        .then(() => this.sendSnapshot(command.sessionId).then(() => this.sendTabs()))
        .catch((error: unknown) => this.publishError(command.sessionId, error));
    } else if (command.type === "focusTab") {
      this.chat.focusTab(command.sessionId);
      this.sendTabs();
    } else if (command.type === "deleteSession") {
      void this.chat
        .deleteSession(command.path)
        .then(() => this.sendCatalogue())
        .catch((error: unknown) => this.publishError(this.chat.activeSessionId(), error));
    } else if (command.type === "closeTab") {
      void this.chat
        .closeTab(command.sessionId)
        // Closing the last tab lands on the home screen, which searches the catalogue.
        .then(() => { this.sendTabs(); return this.sendCatalogue(); })
        .catch((error: unknown) => this.publishError(this.chat.activeSessionId(), error));
    } else if (command.type === "openProject") {
      void this.openTab(() => this.chat.openProject(command.path));
    } else if (command.type === "openSession") {
      void this.openTab(() => this.chat.openSession(command.path));
    } else {
      void this.openTab(() => this.chat.newSession(command.path));
    }
  }

  private async openTab(open: () => Promise<string>): Promise<void> {
    try {
      const sessionId = await open();
      await this.sendSnapshot(sessionId);
      this.sendTabs();
      await this.sendCatalogue();
    } catch (error: unknown) {
      this.publishError(this.chat.activeSessionId(), error);
    }
  }

  private publish(sessionId: string, event: RuntimeEvent): void {
    const message: ServerMessage = {
      version: PROTOCOL_VERSION,
      sessionId,
      sequence: this.nextSequence(sessionId),
      ...event,
    };
    void this.publishToAuthorized(sessionId, message);
    // Status and prompt changes drive the tab dots.
    if (event.type === "runtimeStatus" || event.type === "prompts") this.sendTabs();
  }

  /** A reconnecting browser rebuilds every open tab, not just the active one. */
  private async sendAll(socket: WebSocket): Promise<void> {
    for (const sessionId of this.chat.openSessionIds()) await this.sendSnapshot(sessionId, socket);
    this.sendTabs(socket);
    await this.sendCatalogue(socket);
  }

  /** The home screen has no snapshot to read the catalogue from. */
  private async sendCatalogue(socket?: WebSocket): Promise<void> {
    const targets = socket ? [socket] : this.targetSockets();
    try {
      const catalogue = await this.chat.currentCatalogue();
      const features = this.chat.appFeatures();
      for (const target of targets) this.sendTo(target, { version: PROTOCOL_VERSION, type: "catalogue", catalogue, features });
    } catch (error: unknown) {
      this.publishError(this.chat.activeSessionId(), error);
    }
  }

  private sendTabs(socket?: WebSocket): void {
    for (const target of socket ? [socket] : this.targetSockets()) {
      this.sendTo(target, {
        version: PROTOCOL_VERSION,
        type: "tabs",
        tabs: this.chat.tabs(),
        activeSessionId: this.chat.activeSessionId(),
      });
    }
  }

  /**
   * Snapshots are built per connection: extension state such as the viewer's own
   * role differs between the owner and an invited guest, so one shared payload
   * would tell every browser the same thing.
   */
  private async sendSnapshot(sessionId: string, socket?: WebSocket): Promise<void> {
    const targets = socket ? [this.connectionFor(socket)] : this.snapshotCandidates();
    const sequence = this.sequences.get(sessionId) ?? 0;
    for (const connection of targets) {
      const target = connection?.socket ?? socket;
      if (!target || target.readyState !== WebSocket.OPEN) continue;
      if (connection && !socket) {
        const allowed = await this.chat
          .authorizeConnectionAction("snapshot.authorize", { connectionId: connection.id, sessionId })
          .then(() => true)
          .catch(() => false);
        if (!allowed) continue;
      }
      const snapshot = await this.chat.snapshot(sessionId, connection?.id);
      this.sendTo(target, {
        version: PROTOCOL_VERSION,
        type: "snapshot",
        sequence,
        throughSequence: sequence,
        ...snapshot,
      });
    }
  }

  private snapshotCandidates(): PiChatConnection[] {
    if (this.chat.connectionMode() === "single-controller") {
      const controller = this.controller();
      return controller ? [controller] : [];
    }
    return [...this.connections.values()];
  }

  private publishError(sessionId: string, error: unknown): void {
    const text = error instanceof Error ? error.message : "Unknown runtime error";
    this.publish(sessionId, { type: "runtimeStatus", status: "idle", error: text });
  }

  private nextSequence(sessionId: string): number {
    const next = (this.sequences.get(sessionId) ?? 0) + 1;
    this.sequences.set(sessionId, next);
    return next;
  }

  private controller(): PiChatConnection | undefined {
    return this.controllerId ? this.connections.get(this.controllerId) : undefined;
  }

  private connectionFor(socket: WebSocket): PiChatConnection | undefined {
    return [...this.connections.values()].find((connection) => connection.socket === socket);
  }

  private targetSockets(): WebSocket[] {
    if (this.chat.connectionMode() === "single-controller") {
      const controller = this.controller();
      return controller?.socket.readyState === WebSocket.OPEN ? [controller.socket] : [];
    }
    return [...this.connections.values()]
      .map((connection) => connection.socket)
      .filter((socket) => socket.readyState === WebSocket.OPEN);
  }

  private async publishToAuthorized(sessionId: string, message: ServerMessage): Promise<void> {
    const candidates = this.chat.connectionMode() === "single-controller"
      ? [...(this.controller() ? [this.controller()!] : [])]
      : [...this.connections.values()];
    for (const connection of candidates) {
      if (connection.socket.readyState !== WebSocket.OPEN) continue;
      try {
        await this.chat.authorizeConnectionAction("snapshot.authorize", { connectionId: connection.id, sessionId });
        this.sendTo(connection.socket, message);
      } catch {
        // A denied snapshot/event is simply hidden from that connection.
      }
    }
  }

  private protocolError(error: string): ServerMessage {
    return { version: PROTOCOL_VERSION, type: "protocolError", error };
  }

  private sendTo(socket: WebSocket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }
}
