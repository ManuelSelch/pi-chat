import assert from "node:assert/strict";
import { createPiChatServer, type PiChatServer } from "../../../src/server/bootstrap/server.js";
import { BrowserClient } from "./browser-client.js";
import { BrowserDriver } from "./browser-driver.js";
import { ChatDriver } from "./chat-driver.js";
import { ProjectDriver } from "./project-driver.js";
import { TabDriver } from "./tab-driver.js";
import { TestWorld, type AssistantResponse } from "./test-world.js";
import type { DriverContext } from "./driver-context.js";

async function cleanup(client: BrowserClient | undefined, server: PiChatServer | undefined, world: TestWorld): Promise<void> {
  try { await client?.close(); }
  finally {
    try {
      if (server?.httpServer.listening) await server.close();
      else await server?.transport.close();
    } finally { await world.dispose(); }
  }
}

export interface PiChatDriverOptions {
  responses?: readonly AssistantResponse[];
  timeoutMs?: number;
  /** Start without a conversation; Tabs.Create supplies its own responses. */
  startAtHome?: boolean;
}

/** Owns isolated real Pi sessions, a server, and a browser-facing client. */
export class PiChatDriver {
  readonly Browser: BrowserDriver;
  readonly Chat: ChatDriver;
  readonly Tabs: TabDriver;
  readonly Projects: ProjectDriver;
  private disposal?: Promise<void>;

  private constructor(
    private readonly context: DriverContext,
    private readonly server: PiChatServer,
    private readonly world: TestWorld,
  ) {
    this.Browser = new BrowserDriver(context);
    this.Chat = new ChatDriver(context);
    this.Tabs = new TabDriver(context);
    this.Projects = new ProjectDriver(context);
  }

  static async start(options: PiChatDriverOptions = {}): Promise<PiChatDriver> {
    const timeoutMs = options.timeoutMs ?? 5000;
    assert(Number.isFinite(timeoutMs) && timeoutMs > 0, "timeoutMs must be positive and finite");
    assert(!options.startAtHome || !options.responses?.length, "Supply home-start response scripts to Tabs.Create, not PiChatDriver.start");
    const world = new TestWorld();
    let server: PiChatServer | undefined;
    let client: BrowserClient | undefined;
    try {
      const initial = options.startAtHome ? undefined : await world.create(options.responses ?? []);
      server = createPiChatServer(initial, undefined, world.factory);
      const listeningServer = server;
      await new Promise<void>((resolve, reject) => {
        listeningServer.httpServer.once("error", reject);
        listeningServer.httpServer.listen(0, "127.0.0.1", () => {
          listeningServer.httpServer.off("error", reject);
          resolve();
        });
      });
      client = new BrowserClient(server, timeoutMs);
      const context: DriverContext = {
        client,
        projectPath: world.projectPath,
        reserveSession: responses => world.reserveSession(responses),
        remainingResponses: () => world.remainingResponses(context.client.appState.activeSessionId),
        nextPrompt: () => world.nextPrompt(context.client.appState.activeSessionId),
        releaseControlledResponse: () => world.releaseControlledResponse(context.client.appState.activeSessionId),
        async reconnect() {
          await context.client.close();
          // Fresh state requires authoritative snapshots instead of keeping a
          // cached transcript that could hide a broken reconnect.
          context.client = new BrowserClient(listeningServer, timeoutMs);
          await context.client.ready("Browser.Reconnect");
        },
      };
      const app = new PiChatDriver(context, server, world);
      await client.ready("PiChatDriver.start");
      return app;
    } catch (error) {
      try { await cleanup(client, server, world); }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "PiChatDriver.start failed, then cleanup failed", { cause: error });
      }
      throw error;
    }
  }

  dispose(): Promise<void> {
    this.disposal ??= cleanup(this.context.client, this.server, this.world);
    return this.disposal;
  }
}
