import assert from "node:assert/strict";
import { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { createTestSession, says, when, type TestSession } from "@marcfargas/pi-test-harness";
import { createPiChatServer, type PiChatServer } from "../../../src/server/bootstrap/server.js";
import { PiRuntimeAdapter } from "../../../src/server/runtime/pi/pi-runtime-adapter.js";
import { BrowserClient } from "./browser-client.js";
import { BrowserDriver } from "./browser-driver.js";
import { ChatDriver } from "./chat-driver.js";
import type { DriverContext } from "./driver-context.js";

async function cleanup(client: BrowserClient | undefined, server: PiChatServer | undefined, runtime: AgentSessionRuntime | undefined, harness: TestSession): Promise<void> {
  try { await client?.close(); }
  finally {
    try {
      if (server?.httpServer.listening) await server.close();
      else { await server?.transport.close(); await runtime?.dispose(); }
    } finally { harness.dispose(); }
  }
}

export interface PiChatDriverOptions {
  responses?: readonly { prompt: string; reply: string }[];
  timeoutMs?: number;
}

/** Owns one isolated real Pi session, server, and browser-facing client. */
export class PiChatDriver {
  readonly Browser: BrowserDriver;
  readonly Chat: ChatDriver;
  private disposal?: Promise<void>;

  private constructor(
    private readonly context: DriverContext,
    private readonly server: PiChatServer,
    private readonly runtime: AgentSessionRuntime,
    private readonly harness: TestSession,
  ) {
    this.Browser = new BrowserDriver(context);
    this.Chat = new ChatDriver(context);
  }

  static async start(options: PiChatDriverOptions = {}): Promise<PiChatDriver> {
    const timeoutMs = options.timeoutMs ?? 5000;
    assert(Number.isFinite(timeoutMs) && timeoutMs > 0, "timeoutMs must be positive and finite");
    const harness = await createTestSession();
    let runtime: AgentSessionRuntime | undefined;
    let server: PiChatServer | undefined;
    let client: BrowserClient | undefined;
    try {
      // Even an empty script installs the mocked model; the domain driver also
      // rejects unexpected prompts rather than accepting an exhausted playbook.
      harness.prepare(...(options.responses ?? []).map(({ prompt, reply }) => when(prompt, [says(reply)])));
      const session = harness.session;
      const unsupported = async (): Promise<never> => {
        throw new Error("Session creation/replacement is not implemented by this driver yet");
      };
      runtime = new AgentSessionRuntime(session, {
        cwd: harness.cwd, agentDir: harness.cwd,
        modelRuntime: session.modelRuntime,
        settingsManager: session.settingsManager,
        resourceLoader: session.resourceLoader,
        diagnostics: [],
      }, unsupported);
      server = createPiChatServer(PiRuntimeAdapter.fromRuntime(runtime), undefined, {
        continueProject: unsupported, openSession: unsupported, newSession: unsupported,
      });
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
        remainingResponses: () => harness.playbook.remaining,
        nextPrompt: () => options.responses?.[harness.playbook.consumed]?.prompt.trim(),
        async reconnect() {
          await context.client.close();
          // Fresh state requires authoritative snapshots instead of keeping a
          // cached transcript that could hide a broken reconnect.
          context.client = new BrowserClient(listeningServer, timeoutMs);
          await context.client.ready("Browser.Reconnect");
        },
      };
      const app = new PiChatDriver(context, server, runtime, harness);
      await client.ready("PiChatDriver.start");
      return app;
    } catch (error) {
      // Handle partial setup without hiding the original initialization error.
      try { await cleanup(client, server, runtime, harness); }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "PiChatDriver.start failed, then cleanup failed", { cause: error });
      }
      throw error;
    }
  }

  dispose(): Promise<void> {
    this.disposal ??= cleanup(this.context.client, this.server, this.runtime, this.harness);
    return this.disposal;
  }
}
