import express from "express";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { ChatApplicationService } from "./chat-application-service.js";
import type { RuntimeAdapter } from "./runtime-adapter.js";
import { WebSocketTransport } from "./websocket-transport.js";

export interface PiChatServer {
  httpServer: Server;
  transport: WebSocketTransport;
  close(): Promise<void>;
}

export function createPiChatServer(runtime: RuntimeAdapter, staticDirectory?: string): PiChatServer {
  const app = express();
  app.get("/health", (_request, response) => response.json({ ok: true }));
  if (staticDirectory) {
    app.use(express.static(staticDirectory));
    app.get("/{*path}", (_request, response) => response.sendFile(resolve(staticDirectory, "index.html")));
  }

  const httpServer = createServer(app);
  const chat = new ChatApplicationService(runtime);
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
