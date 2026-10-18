import type { Server, IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { snapshotSchema, operationSchemas, type Capability, type ServerMessage, type Event } from "@manuelselch/pi-sdk/contract/v2";
import { ChatApplicationService } from "../application/chat-application-service.js";
import { ServerPublisher } from "./server-publisher.js";
import { executeOperation } from "./command-handler.js";
import { V2Connection } from "./v2-connection.js";
import type { FileLogger } from "../logging/file-logger.js";

const MAX_FRAME_BYTES = 16_777_216;
const MAX_SEND_BYTES = 16_777_216;
/** Only same-origin browsers may use this private, proxy-authenticated endpoint. */
function validOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return true; // Native/CLI clients do not send browser Origin.
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && url.host.toLowerCase() === request.headers.host?.toLowerCase() && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch { return false; }
}
export class WebSocketTransport {
  private readonly server: WebSocketServer;
  private controller?: { socket: WebSocket; connection: V2Connection; capabilities: readonly Capability[] };
  private readonly publisher: ServerPublisher;
  private readonly unsubscribe: () => void;
  constructor(httpServer: Server, private readonly chat: ChatApplicationService, private readonly logger?: FileLogger) {
    this.server = new WebSocketServer({ server: httpServer, path: "/ws", maxPayload: MAX_FRAME_BYTES,
      verifyClient: ({ req }, done) => done(validOrigin(req), 403, "Browser origin is not allowed") });
    this.publisher = new ServerPublisher(chat, event => this.publish(event), logger);
    this.unsubscribe = chat.subscribe((sessionId, event) => this.publisher.publish(sessionId, event));
    this.server.on("connection", socket => this.connect(socket));
  }
  async close(): Promise<void> {
    this.unsubscribe();
    for (const socket of this.server.clients) socket.terminate();
    await new Promise<void>(resolve => this.server.close(() => resolve()));
  }
  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState !== WebSocket.OPEN) throw new Error("Socket unavailable");
    const payload = JSON.stringify(message);
    if (Buffer.byteLength(payload) > MAX_FRAME_BYTES || socket.bufferedAmount + Buffer.byteLength(payload) > MAX_SEND_BYTES) {
      socket.close(1009, "Publication limit exceeded; reconnect to resynchronize"); throw new Error("Publication limit exceeded");
    }
    socket.send(payload, error => { if (error) socket.terminate(); });
  }
  private publish(event: Event): void {
    const controller = this.controller;
    if (!controller?.connection.ready) return;
    if (event.event === "presentation.changed" && !controller.capabilities.includes("presentation")) return;
    let publication = event;
    if (!controller.capabilities.includes("presentation") && (event.event === "session.snapshot" || event.event === "session.replaced")) {
      const snapshot = event.event === "session.snapshot" ? event.data : event.data.snapshot;
      const { presentation: _presentation, ...core } = snapshot;
      publication = event.event === "session.snapshot" ? { ...event, data: core } : { ...event, data: { ...event.data, snapshot: core } };
    }
    try { this.send(controller.socket, publication); } catch { controller.socket.terminate(); }
  }
  private connect(socket: WebSocket): void {
    const connectionId = randomUUID(); let selected: Capability[] = [];
    this.logger?.info("websocket.open", { connectionId });
    const capabilities: Capability[] = ["presentation", "directory.browse", "command.complete", "session.archive", "project.pin", "project.remove", "file.open", ...(this.chat.appFeatures().length ? ["server.restart" as const] : [])];
    const connection = new V2Connection({
      serverInstanceId: this.publisher.serverInstanceId, connectionId, capabilities,
      isWritable: () => socket.readyState === WebSocket.OPEN,
      isController: () => this.controller?.socket === socket,
      claim: () => {
        const previous = this.controller;
        this.controller = { socket, connection, capabilities: selected };
        previous?.connection.dispose(); previous?.socket.close(4001, "Controller replaced");
        this.chat.resumePrompts();
      },
      send: message => this.send(socket, message), close: (code, reason) => socket.close(code, reason),
      prepareInitialize: async (_params, selectedCapabilities) => { selected = selectedCapabilities; return this.publisher.prepareInitial(connectionId, selected); },
      execute: async request => {
        const execution = await executeOperation(request, this.chat, this.publisher);
        if (execution.kind === "completed" && !selected.includes("presentation") && (request.method === "session.snapshot" || request.method === "session.open" || request.method === "session.create")) {
          if (request.method === "session.snapshot") {
            const { presentation: _, ...core } = snapshotSchema.parse(execution.result); return { ...execution, result: core };
          }
          const result = operationSchemas["session.open"].result.parse(execution.result);
          const { presentation: _, ...snapshot } = result.snapshot; return { ...execution, result: { ...result, snapshot } };
        }
        return execution;
      },
      outcome: (request, operationId, outcome, error) => { if (request.sessionId) this.publisher.operation(request.sessionId, operationId, request.requestId, outcome, error); },
    });
    socket.on("message", (data, binary) => { if (binary) { socket.close(1003, "Text JSON frames required"); return; } connection.receive(data.toString()); });
    socket.on("error", error => this.logger?.error("websocket.error", { connectionId, message: error.message }));
    socket.on("close", (code, reason) => {
      this.logger?.info("websocket.close", { connectionId, code, reason: reason.toString("utf8").slice(0, 256), controller: this.controller?.socket === socket, runtimeActive: this.chat.tabs().some(tab => tab.status !== "idle") });
      connection.dispose(); if (this.controller?.socket !== socket) return; this.controller = undefined; this.chat.suspendPrompts();
    });
  }
}
