import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { expect } from "vitest";
import WebSocket from "ws";
import { PiClient, createWebSocketTransport } from "@manuelselch/pi-sdk";
import { createPiServer, type PiServer } from "../../src/index.js";
import { FakeRuntimeAdapter } from "../../src/testing/fake-runtime-adapter.js";
import { WidgetRegistry } from "../../src/extensions/ui/widget-registry.js";
import { createWebUiContext } from "../../src/runtime/pi/web-ui-context.js";

/** Real normalization/UI context, server, socket, schemas and SDK; no model needed. */
class WidgetRuntime extends FakeRuntimeAdapter {
  readonly widgets = new WidgetRegistry(widgets => this.emit({ type: "widgets", widgets }));
  readonly context = createWebUiContext({
    onNotify: () => {}, onPrompt: async () => ({ cancelled: true }),
    onWidget: (key, lines, placement) => this.widgets.set(key, lines, placement),
  });
  override snapshot() { return { ...super.snapshot(), widgets: this.widgets.list() }; }
}

export class WidgetTransportDriver {
  private readonly runtime = new WidgetRuntime();
  private server!: PiServer;
  private client!: PiClient;
  private id!: string;
  private expected: string[] = [];

  static async start(): Promise<WidgetTransportDriver> {
    const driver = new WidgetTransportDriver();
    try {
      driver.server = await createPiServer({ runtime: driver.runtime });
      driver.server.httpServer.listen(0, "127.0.0.1");
      await once(driver.server.httpServer, "listening");
      driver.client = new PiClient({
        endpoint: `ws://127.0.0.1:${(driver.server.httpServer.address() as AddressInfo).port}/ws`,
        transport: createWebSocketTransport(url => new WebSocket(url)), capabilities: ["presentation"],
      });
      driver.show("success");
      driver.client.start();
      await driver.ready();
      driver.id = driver.client.getState().inventory[0]!.sessionId;
      return driver;
    } catch (error) { await driver.dispose(); throw error; }
  }

  private async ready(): Promise<void> {
    await expect.poll(() => this.client.getState().connection.phase).toBe("ready");
  }

  show(color: "success" | "error"): void {
    const theme = this.runtime.context.theme;
    this.expected = [theme.fg(color, theme.bold("Status")), "  second line 😀"];
    this.runtime.context.setWidget("status", this.expected);
  }

  async shouldPreserveStyledWidget(): Promise<void> {
    expect(this.expected[0]).toContain("\u001b[");
    await expect.poll(() => this.client.getSession(this.id)?.widgets[0]?.lines).toEqual(this.expected);
  }

  async shouldPreserveSnapshot(): Promise<void> {
    const snapshot = await this.client.request("session.snapshot", {}, this.id);
    expect(snapshot.presentation?.widgets[0]?.lines).toEqual(this.expected);
  }

  async reconnect(): Promise<void> { this.client.stop(); this.client.start(); await this.ready(); }

  clear(): void { this.runtime.context.setWidget("status", undefined); }

  async shouldHaveNoWidgets(): Promise<void> {
    await expect.poll(() => this.client.getSession(this.id)?.widgets).toEqual([]);
  }

  async dispose(): Promise<void> { this.client?.dispose(); await this.server?.close(); }
}
