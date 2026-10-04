import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import {
  CONTROLLER_REPLACED_CODE,
  PROTOCOL_VERSION,
  parseClientMessage,
} from "../../shared/protocol.js";
import { ChatApplicationService } from "../application/chat-application-service.js";
import { ServerPublisher } from "./server-publisher.js";

export class WebSocketTransport {
  private readonly server: WebSocketServer;
  private controller?: WebSocket;
  private readonly publisher: ServerPublisher;
  private readonly unsubscribe: () => void;

  constructor(httpServer: Server, private readonly chat: ChatApplicationService) {
    this.server = new WebSocketServer({ server: httpServer, path: "/ws" });
    this.publisher = new ServerPublisher(chat, () => this.controller);
    this.unsubscribe = chat.subscribe((sessionId, event) => this.publisher.publish(sessionId, event));
    this.server.on("connection", (socket) => this.connect(socket));
  }

  async close(): Promise<void> {
    this.unsubscribe();
    this.controller?.close();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private connect(socket: WebSocket): void {
    if (this.controller?.readyState === WebSocket.OPEN) {
      this.publisher.sendTo(this.controller, this.publisher.protocolError("Another browser took control of this Pi Chat session."));
      this.controller.close(CONTROLLER_REPLACED_CODE, "Controller replaced");
    }
    this.controller = socket;
    // A browser is in control again, so pending dialogs stop counting down.
    this.chat.resumePrompts();
    void this.publisher.sendAll(socket);

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

    const command = result.value;
    if (socket !== this.controller) return;
    if (command.type === "browseDirectories") {
      this.chat.browseDirectories(command).then(
        (listing) => this.publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "directoryListing", requestId: command.requestId, listing }),
        (error: unknown) => this.publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "directoryBrowseError", requestId: command.requestId, error: this.publisher.errorText(error) }),
      );
    } else if (command.type === "abort") {
      this.chat.abort(command.sessionId).catch((error: unknown) => this.publisher.publishError(command.sessionId, error));
    } else if (command.type === "prompt") {
      // A prompt can be a native command such as /model, which changes state
      // the snapshot owns, so refresh once the run settles.
      this.chat
        .prompt(command.sessionId, command.message)
        .then((sessionId) => this.publisher.sendSnapshot(sessionId))
        .catch((error: unknown) => this.publisher.publishError(command.sessionId, error));
    } else if (command.type === "uiPromptResponse") {
      this.chat.respondToPrompt(command.sessionId, command.promptId, command.result);
    } else if (command.type === "runFeature" || command.type === "runExtensionAction") {
      this.chat
        .runFeature(command)
        .then(() => {
          // Renaming changes the tab label too, so the tab list must follow.
          void this.publisher.sendSnapshot(command.sessionId);
          this.publisher.sendTabs();
        })
        .catch((error: unknown) => this.publisher.publishError(command.sessionId, error));
    } else if (command.type === "focusTab") {
      this.chat.focusTab(command.sessionId);
      this.publisher.sendTabs();
    } else if (command.type === "deleteSession") {
      this.chat
        .deleteSession(command.path)
        .then(() => this.publisher.sendCatalogue())
        .catch((error: unknown) => this.publisher.publishError(this.chat.activeSessionId(), error));
    } else if (command.type === "closeTab") {
      this.chat
        .closeTab(command.sessionId)
        .then(() => {
          // Closing the last tab lands on the home screen, which searches the catalogue.
          this.publisher.sendTabs();
          return this.publisher.sendCatalogue();
        })
        .catch((error: unknown) => this.publisher.publishError(this.chat.activeSessionId(), error));
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
        this.publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "sessionOpenError", requestId, error: this.publisher.errorText(error) });
      } else this.publisher.publishError(this.chat.activeSessionId(), error);
      return;
    }
    // Creation succeeded even if a later snapshot/catalogue refresh fails.
    try {
      await this.publisher.sendSnapshot(sessionId);
      this.publisher.sendTabs();
      await this.publisher.sendCatalogue();
    } catch (error: unknown) {
      this.publisher.publishError(sessionId, error);
    } finally {
      if (requestId && socket) this.publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "sessionOpened", requestId, sessionId });
    }
  }

}
