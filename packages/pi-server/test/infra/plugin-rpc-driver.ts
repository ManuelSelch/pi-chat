import { once } from "node:events";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { expect } from "vitest";
import { PiClient, createWebSocketTransport } from "@manuelselch/pi-sdk";
import { definePlugin, defineRemoteContract, type RemoteContract, type Plugin } from "@manuelselch/pi-sdk/plugins";
import { createPiServer, type PiServer } from "../../src/index.js";
import { z } from "zod";

const stateContract = defineRemoteContract({
  id: "test-state", version: 1,
  methods: {
    read: { input: z.null(), output: z.string() },
    write: { input: z.string(), output: z.string() },
  },
});
const statePlugin = definePlugin({
  id: "test-state", provides: [stateContract],
  host: async () => ({ setup(ctx) {
    let value = "initial";
    ctx.provide(stateContract, { read: () => value, write: next => value = next });
  } }),
});
import { v2Socket } from "./v2-socket.js";

export class PluginRpcDriver {
  private server?: PiServer;
  private clients: PiClient[] = [];
  private pendingEntered?: Promise<void>;

  async start(expose = true, plugin: Plugin = statePlugin, contract: RemoteContract = stateContract): Promise<void> {
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
      ...statePlugin,
      host: async () => ({ setup(ctx) {
        let finish!: () => void;
        const released = new Promise<void>(resolve => { finish = resolve; });
        ctx.onCleanup(finish);
        ctx.provide(stateContract, {
          read: () => "initial",
          write: async value => { entered(); await released; return value; },
        });
      } }),
    });
    await this.start(true, plugin);
  }

  async shouldRejectWireCallWithoutCapability(): Promise<void> {
    const remote = await v2Socket(this.server!);
    try {
      await remote.initialize([]);
      remote.send("plugin.call", "denied", { contractId: stateContract.id, contractVersion: 1, method: "write", input: "updated" });
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

  async shouldRead(value: string, connection = 0): Promise<void> {
    await expect(this.clients[connection]!.plugin(stateContract).read(null)).resolves.toBe(value);
  }

  async shouldWrite(value: string, connection = 0): Promise<void> {
    await expect(this.clients[connection]!.plugin(stateContract).write(value)).resolves.toBe(value);
  }

  async shouldRejectCall(code: string, overrides: Record<string, unknown> = {}, connection = 0): Promise<void> {
    await expect(this.clients[connection]!.request("plugin.call", {
      contractId: stateContract.id, contractVersion: stateContract.version, method: "write", input: "updated",
      ...overrides,
    })).rejects.toMatchObject({ code });
  }

  async shouldRejectUninitializedCall(): Promise<void> {
    const remote = await v2Socket(this.server!);
    try {
      remote.send("plugin.call", "early", { contractId: stateContract.id, contractVersion: 1, method: "write", input: "updated" });
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
    const pending = this.clients[0]!.plugin(stateContract).write("updated");
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
