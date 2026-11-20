import express from "express";
import type { PluginDefinition, RemoteContract } from "@manuelselch/pi-sdk/plugins";
import { PluginRpc } from "./transport/plugin-rpc.js";
import { createPluginRuntime } from "./plugins/runtime.js";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import type { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { ChatApplicationService } from "./application/chat-application-service.js";
import { getPiChatExtensionRegistry, type PiChatExtensionRegistry } from "./extensions/extension-registry.js";
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
  /** Explicit built-in host plugins, activated once per server before readiness. */
  plugins?: readonly PluginDefinition[];
  /** Contracts explicitly exposed over the existing WebSocket; none by default. */
  pluginRpcContracts?: readonly RemoteContract[];
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
export async function createPiServer(options: PiServerOptions = {}): Promise<PiServer> {
  const plugins = createPluginRuntime(options.plugins ?? []);
  await plugins.start();

  const teardown: (() => void | Promise<void>)[] = [() => plugins.dispose()];
  async function cleanup(): Promise<void> {
    const errors: unknown[] = [];
    for (const release of teardown) {
      try { await release(); }
      catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Server cleanup failed.");
  }

  try {
    const pluginRpc = new PluginRpc(plugins, options.pluginRpcContracts ?? []);
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
    teardown.unshift(async () => {
      if (httpServer.listening) await new Promise<void>((done, reject) => httpServer.close(error => error ? reject(error) : done()));
    });
    const extensions = options.extensions ?? getPiChatExtensionRegistry();
    const chat = new ChatApplicationService(options.runtime, factory, projects, options.restart, extensions, undefined, options.files);
    teardown.push(() => chat.dispose());
    const transport = new WebSocketTransport(httpServer, chat, options.logger, pluginRpc);
    teardown.unshift(() => transport.close());
    const releaseSessionHost = extensions.bindSessionHost({ archive: path => transport.archiveSession(path) });
    teardown.unshift(releaseSessionHost);
    let closing: Promise<void> | undefined;
    return { httpServer, close() {
      return closing ??= (async () => {
        options.logger?.info("server.shutdown");
        await cleanup();
      })();
    } };
  } catch (error) {
    try { await cleanup(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], "Server startup and cleanup failed."); }
    throw error;
  }
}
