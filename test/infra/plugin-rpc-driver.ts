import { once } from "node:events";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { expect } from "vitest";
import { PiClient, createWebSocketTransport } from "@manuelselch/pi-sdk";
import { definePlugin, type RemoteContract, type PluginDefinition } from "@manuelselch/pi-sdk/plugins";
import { createPiServer, type PiServer } from "../../src/index.js";
import counterPlugin from "../fixtures/plugins/counter/index.js";
import { counterContract } from "../fixtures/plugins/counter/contract.js";
import { v2Socket } from "./v2-socket.js";

export class PluginRpcDriver {
  private server?: PiServer;
  private clients: PiClient[] = [];
  private pendingEntered?: Promise<void>;

  async start(expose = true, plugin: PluginDefinition = counterPlugin, contract: RemoteContract = counterContract): Promise<void> {
    this.server = await createPiServer({
      plugins: [plugin], pluginRpcContracts: expose ? [contract] : [],
      catalogue: { homeDirectory: null, lister: { listAll: async () => [] } },
    });
    this.server.httpServer.listen(0, "127.0.0.1");
    await once(this.server.httpServer, "listening");
  }

  async startPending(): Promise<void> {
    let entered!: () => void;
    this.pendingEntered = new Promise<void>(resolve => { entered = resolve; });
    const plugin = definePlugin({
      ...counterPlugin,
      host: async () => ({ setup(ctx) {
        let finish!: () => void;
        const released = new Promise<void>(resolve => { finish = resolve; });
        ctx.onCleanup(finish);
        ctx.provide(counterContract, {
          read: () => 0,
          increment: async () => { entered(); await released; return 1; },
        });
      } }),
    });
    await this.start(true, plugin);
  }

  async shouldRejectWireCallWithoutCapability(): Promise<void> {
    const remote = await v2Socket(this.server!);
    try {
      await remote.initialize([]);
      remote.send("plugin.call", "denied", { contractId: counterContract.id, contractVersion: 1, method: "increment", input: null });
      expect(await remote.response("denied")).toMatchObject({ ok: false, error: { code: "unsupportedOperation" } });
    } finally {
      remote.socket.terminate();
    }
  }

  async connect(capabilities: ("plugin.call")[] = ["plugin.call"]): Promise<number> {
    const client = new PiClient({
      endpoint: `ws://127.0.0.1:${(this.server!.httpServer.address() as AddressInfo).port}/ws`,
      transport: createWebSocketTransport(url => new WebSocket(url)), capabilities,
    });
    this.clients.push(client);
    client.start();
    await expect.poll(() => client.getState().connection.phase).toBe("ready");
    expect(client.getState().inventory).toEqual([]);
    return this.clients.length - 1;
  }

  async shouldRead(value: number, connection = 0): Promise<void> {
    await expect(this.clients[connection]!.plugin(counterContract).read(null)).resolves.toBe(value);
  }

  async shouldIncrement(value: number, connection = 0): Promise<void> {
    await expect(this.clients[connection]!.plugin(counterContract).increment(null)).resolves.toBe(value);
  }

  async shouldRejectCall(code: string, overrides: Record<string, unknown> = {}, connection = 0): Promise<void> {
    await expect(this.clients[connection]!.request("plugin.call", {
      contractId: counterContract.id, contractVersion: counterContract.version, method: "increment", input: null,
      ...overrides,
    })).rejects.toMatchObject({ code });
  }

  async shouldRejectUninitializedCall(): Promise<void> {
    const remote = await v2Socket(this.server!);
    try {
      remote.send("plugin.call", "early", { contractId: counterContract.id, contractVersion: 1, method: "increment", input: null });
      expect(await remote.response("early")).toMatchObject({ ok: false, error: { code: "notInitialized" } });
    } finally {
      remote.socket.terminate();
    }
  }

  async reconnect(connection = 0): Promise<void> {
    const client = this.clients[connection]!;
    client.stop();
    client.start();
    await expect.poll(() => client.getState().connection.phase).toBe("ready");
  }

  async shouldRejectPendingOnClose(): Promise<void> {
    const pending = this.clients[0]!.plugin(counterContract).increment(null);
    const rejection = expect(pending).rejects.toMatchObject({ code: "disconnected", outcome: "unknown" });
    await this.pendingEntered;
    await this.server!.close();
    await rejection;
  }

  async dispose(): Promise<void> {
    for (const client of this.clients) client.dispose();
    await this.server?.close();
  }
}
