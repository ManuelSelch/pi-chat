import express from "express";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import type { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { ChatApplicationService } from "./application/chat-application-service.js";
import type { PiChatExtensionRegistry } from "./extensions/extension-registry.js";
import { PiRuntimeAdapter } from "./runtime/pi/pi-runtime-adapter.js";
import { ProjectSessionService } from "./projects/project-session-service.js";
import { ProjectMetadataStore } from "./projects/project-metadata-store.js";
import type { ProjectSessionLister } from "./projects/catalogue-types.js";
import type { WorktreeRepository } from "./projects/worktree-discovery.js";
import { WebSocketTransport } from "./transport/websocket-transport.js";
import type { RuntimeAdapter, RuntimeAdapterFactory } from "./runtime/contracts.js";
import type { FileService } from "./files/file-service.js";
import type { FileLogger } from "./logging/file-logger.js";
import type { RestartService } from "./bootstrap/restart-service.js";

export type { RuntimeAdapter, RuntimeAdapterFactory, RuntimeSnapshot, RuntimeEvent } from "./runtime/contracts.js";
export { createRestartService } from "./bootstrap/restart-service.js";
export type { RestartService, RestartPlan, RestartOptions } from "./bootstrap/restart-service.js";
export { createFileLogger } from "./logging/file-logger.js";
export type { FileLogger, FileLoggerOptions } from "./logging/file-logger.js";
export type { ProjectSessionLister, PersistedSessionRecord } from "./projects/catalogue-types.js";
export type { WorktreeRepository, DiscoveredWorktree } from "./projects/worktree-discovery.js";

export interface CatalogueOptions {
  lister?: ProjectSessionLister;
  sessionsDirectory?: string;
  discovery?: { forDirectory(directory: string): Promise<WorktreeRepository | undefined> };
  metadataFile?: string;
  /** null suppresses the permanent home-folder catalogue entry in isolated hosts. */
  homeDirectory?: string | null;
}
export interface PiServerOptions {
  runtime?: RuntimeAdapter;
  runtimeFactory?: RuntimeAdapterFactory;
  staticDirectory?: string;
  restart?: RestartService;
  extensions?: PiChatExtensionRegistry;
  files?: Pick<FileService, "open">;
  logger?: FileLogger;
  catalogue?: CatalogueOptions;
}
export interface PiServer {
  httpServer: Server;
  close(): Promise<void>;
}
export function createPiRuntimeAdapter(runtime: AgentSessionRuntime): RuntimeAdapter {
  return PiRuntimeAdapter.fromRuntime(runtime);
}
export function createPiServer(options: PiServerOptions = {}): PiServer {
  const catalogue = options.catalogue ?? {};
  const projects = new ProjectSessionService(catalogue.lister, catalogue.sessionsDirectory, catalogue.discovery,
    catalogue.metadataFile ? new ProjectMetadataStore(catalogue.metadataFile) : undefined,
    catalogue.homeDirectory);
  const factory = options.runtimeFactory ?? {
    continueProject: (path: string) => PiRuntimeAdapter.create(path),
    openSession: (path: string) => PiRuntimeAdapter.openSession(path),
    newSession: (path: string) => PiRuntimeAdapter.newSession(path),
  };
  const app = express();
  app.get("/health", (_request, response) => response.json({ ok: true }));
  if (options.staticDirectory) {
    const directory = resolve(options.staticDirectory);
    app.use(express.static(directory));
    app.get("/{*path}", (_request, response) => response.sendFile(resolve(directory, "index.html")));
  }
  const httpServer = createServer(app);
  const chat = new ChatApplicationService(options.runtime, factory, projects, options.restart, options.extensions, undefined, options.files);
  const transport = new WebSocketTransport(httpServer, chat, options.logger);
  let closing: Promise<void> | undefined;
  return { httpServer, close() {
    return closing ??= (async () => {
      options.logger?.info("server.shutdown");
      try {
        await transport.close();
        if (httpServer.listening) await new Promise<void>((done, reject) => httpServer.close(error => error ? reject(error) : done()));
      } finally { await chat.dispose(); }
    })();
  } };
}
