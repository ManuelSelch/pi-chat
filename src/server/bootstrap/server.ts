import express from "express";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { ChatApplicationService } from "../application/chat-application-service.js";
import type { PiChatExtensionRegistry } from "../extensions/extension-registry.js";
import { PiRuntimeAdapter } from "../runtime/pi/pi-runtime-adapter.js";
import { ProjectSessionService } from "../projects/project-session-service.js";
import { PiSessionStore } from "../projects/pi-session-store.js";
import type { RuntimeAdapter, RuntimeAdapterFactory } from "../runtime/contracts.js";
import type { RestartService } from "./restart-service.js";
import { WebSocketTransport } from "../transport/websocket-transport.js";
import type { FileService } from "../files/file-service.js";

export interface PiChatServer {
  httpServer: Server;
  transport: WebSocketTransport;
  close(): Promise<void>;
}

export function createPiChatServer(
  runtime: RuntimeAdapter | undefined,
  staticDirectory?: string,
  factory: RuntimeAdapterFactory = {
    continueProject: (path) => PiRuntimeAdapter.create(path),
    openSession: (path) => PiRuntimeAdapter.openSession(path),
    newSession: (path) => PiRuntimeAdapter.newSession(path),
  },
  restart?: RestartService,
  extensions?: PiChatExtensionRegistry,
  files?: FileService,
): PiChatServer {
  const app = express();
  app.get("/health", (_request, response) => response.json({ ok: true }));
  if (staticDirectory) {
    app.use(express.static(staticDirectory));
    app.get("/{*path}", (_request, response) => response.sendFile(resolve(staticDirectory, "index.html")));
  }

  const httpServer = createServer(app);
  const projectSessions = new ProjectSessionService(new PiSessionStore());
  const chat = new ChatApplicationService(runtime, factory, projectSessions, restart, extensions, undefined, files);
  const transport = new WebSocketTransport(httpServer, chat);
  return {
    httpServer,
    transport,
    async close() {
      await transport.close();
      await new Promise<void>((resolveClose, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolveClose()));
      });
      await chat.dispose();
    },
  };
}
