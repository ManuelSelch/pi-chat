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

    socket.on("message", (data) => this.handleMessage(socket, data));

    socket.on("close", () => {
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
    if (socket !== this.controller) return;
    if (command.type === "browseDirectories") {
      this.chat.browseDirectories(command).then(
        (listing) => this.replyTo(socket, { version: PROTOCOL_VERSION, type: "directoryListing", requestId: command.requestId, listing }),
        (error: unknown) => this.replyTo(socket, { version: PROTOCOL_VERSION, type: "directoryBrowseError", requestId: command.requestId, error: this.errorText(error) }),
      );
    } else if (command.type === "abort") {
      this.chat.abort(command.sessionId).catch((error: unknown) => this.publishError(command.sessionId, error));
    } else if (command.type === "prompt") {
      // A prompt can be a native command such as /model, which changes state
      // the snapshot owns, so refresh once the run settles.
      this.chat
        .prompt(command.sessionId, command.message)
        .then((sessionId) => this.sendSnapshot(sessionId))
        .catch((error: unknown) => this.publishError(command.sessionId, error));
    } else if (command.type === "uiPromptResponse") {
      this.chat.respondToPrompt(command.sessionId, command.promptId, command.result);
    } else if (command.type === "runFeature" || command.type === "runExtensionAction") {
      this.chat
        .runFeature(command)
        .then(() => {
          // Renaming changes the tab label too, so the tab list must follow.
          void this.sendSnapshot(command.sessionId);
          this.sendTabs();
        })
        .catch((error: unknown) => this.publishError(command.sessionId, error));
    } else if (command.type === "focusTab") {
      this.chat.focusTab(command.sessionId);
      this.sendTabs();
    } else if (command.type === "deleteSession") {
      this.chat
        .deleteSession(command.path)
        .then(() => this.sendCatalogue())
        .catch((error: unknown) => this.publishError(this.chat.activeSessionId(), error));
    } else if (command.type === "closeTab") {
      this.chat
        .closeTab(command.sessionId)
        .then(() => {
          // Closing the last tab lands on the home screen, which searches the catalogue.
          this.sendTabs();
          return this.sendCatalogue();
        })
        .catch((error: unknown) => this.publishError(this.chat.activeSessionId(), error));
    } else if (command.type === "openProject") {
      void this.openTab(() => this.chat.openProject(command.path));
    } else if (command.type === "openSession") {
      void this.openTab(() => this.chat.openSession(command.path));
    } else if (command.type === "newSession") {
      void this.openTab(() => this.chat.newSession(command.path), socket, command.requestId);
    }
  }

  private async openTab(open: () => Promise<string>, socket = this.controller, requestId?: string): Promise<void> {
    let sessionId: string;
    try {
      sessionId = await open();
    } catch (error: unknown) {
      if (requestId && socket) {
        this.replyTo(socket, { version: PROTOCOL_VERSION, type: "sessionOpenError", requestId, error: this.errorText(error) });
      } else this.publishError(this.chat.activeSessionId(), error);
      return;
    }
    // Creation succeeded even if a later snapshot/catalogue refresh fails.
    try {
      await this.sendSnapshot(sessionId);
      this.sendTabs();
      await this.sendCatalogue();
    } catch (error: unknown) {
      this.publishError(sessionId, error);
    } finally {
      if (requestId && socket) this.replyTo(socket, { version: PROTOCOL_VERSION, type: "sessionOpened", requestId, sessionId });
    }
  }

  private errorText(error: unknown): string {
    return error instanceof Error ? error.message : "Unable to open this server folder.";
  }

  /** Correlated app replies stay with the originating controller, never a replacement. */
  private replyTo(socket: WebSocket, message: ServerMessage): void {
    if (socket === this.controller && socket.readyState === WebSocket.OPEN) this.sendTo(socket, message);
  }

  private publish(sessionId: string, event: RuntimeEvent): void {
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
      this.sendTo(socket, { version: PROTOCOL_VERSION, type: "catalogue", catalogue: await this.chat.currentCatalogue(), features: this.chat.appFeatures() });
    } catch (error: unknown) {
      this.publishError(this.chat.activeSessionId(), error);
    }
  }

  private sendTabs(socket = this.controller): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    this.sendTo(socket, { version: PROTOCOL_VERSION, type: "tabs", tabs: this.chat.tabs(), activeSessionId: this.chat.activeSessionId() });
  }

  private async sendSnapshot(sessionId: string, socket = this.controller): Promise<void> {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const sequence = this.sequences.get(sessionId) ?? 0;
    const snapshot = await this.chat.snapshot(sessionId);
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

  private send(message: ServerMessage): void {
    if (this.controller?.readyState === WebSocket.OPEN) this.sendTo(this.controller, message);
  }

  private sendTo(socket: WebSocket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }
}
