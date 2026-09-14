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
  /** Per session: a busy tab must not advance a quiet tab's sequence. */
  private readonly sequences = new Map<string, number>();
  private controller?: WebSocket;
  private readonly unsubscribe: () => void;

  constructor(httpServer: Server, private readonly chat: ChatApplicationService) {
    this.server = new WebSocketServer({ server: httpServer, path: "/ws" });
    this.unsubscribe = chat.subscribe((sessionId, event) => this.publish(sessionId, event));
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
    void this.sendAll(socket);

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

      const command = result.value;
      if (command.type === "abort") {
        void this.chat.abort(command.sessionId).catch((error: unknown) => this.publishError(command.sessionId, error));
      } else if (command.type === "prompt") {
        // A prompt can be a native command such as /model, which changes state
        // the snapshot owns, so refresh once the run settles.
        void this.chat
          .prompt(command.sessionId, command.message)
          .then(() => this.sendSnapshot(command.sessionId))
          .catch((error: unknown) => this.publishError(command.sessionId, error));
      } else if (command.type === "uiPromptResponse") {
        this.chat.respondToPrompt(command.sessionId, command.promptId, command.result);
      } else if (command.type === "runFeature") {
        void this.chat
          .runFeature(command)
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
    });

    socket.on("close", () => {
      if (this.controller !== socket) return;
      this.controller = undefined;
      // A reload must not cancel a permission gate, so pending dialogs only
      // expire after the registry's grace period without a controller.
      this.chat.suspendPrompts();
    });
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
    if (this.controller?.readyState === WebSocket.OPEN) this.sendTo(this.controller, message);
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
  private async sendCatalogue(socket = this.controller): Promise<void> {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      const catalogue = await this.chat.currentCatalogue();
      const features = this.chat.appFeatures();
      this.sendTo(socket, { version: PROTOCOL_VERSION, type: "catalogue", catalogue, features });
    } catch (error: unknown) {
      this.publishError(this.chat.activeSessionId(), error);
    }
  }

  private sendTabs(socket = this.controller): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    this.sendTo(socket, {
      version: PROTOCOL_VERSION,
      type: "tabs",
      tabs: this.chat.tabs(),
      activeSessionId: this.chat.activeSessionId(),
    });
  }

  private async sendSnapshot(sessionId: string, socket = this.controller): Promise<void> {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const snapshot = await this.chat.snapshot(sessionId);
    const sequence = this.sequences.get(sessionId) ?? 0;
    this.sendTo(socket, {
      version: PROTOCOL_VERSION,
      type: "snapshot",
      sequence,
      throughSequence: sequence,
      ...snapshot,
    });
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

  private protocolError(error: string): ServerMessage {
    return { version: PROTOCOL_VERSION, type: "protocolError", error };
  }

  private sendTo(socket: WebSocket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }
}
