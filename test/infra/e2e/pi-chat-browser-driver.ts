import { resolve } from "node:path";
import { AddressInfo } from "node:net";
import { expect, type Locator, type Page } from "@playwright/test";
import { createPiChatServer, type PiChatServer } from "../../../src/server/bootstrap/server.js";
import { TestWorld } from "../pi-chat/test-world.js";
import { BrowserBrowserDriver } from "./browser-browser-driver.js";
import { BrowserChatDriver } from "./browser-chat-driver.js";
import { BrowserHomeDriver } from "./browser-home-driver.js";
import { BrowserTabsDriver } from "./browser-tabs-driver.js";

/** Visible-browser application driver. Playwright types and selectors stay behind this API. */
export class PiChatBrowserDriver {
  readonly Browser: BrowserBrowserDriver;
  readonly Chat: BrowserChatDriver;
  readonly Home: BrowserHomeDriver;
  readonly Tabs: BrowserTabsDriver;
  private readonly composer: Locator;
  private disposed?: Promise<void>;

  private constructor(
    private readonly page: Page,
    private readonly world: TestWorld,
    private readonly cleanup: () => Promise<void>,
  ) {
    this.composer = page.getByRole("textbox", { name: "Message Pi" });
    this.Browser = new BrowserBrowserDriver(page);
    this.Chat = new BrowserChatDriver(page, this.composer);
    this.Home = new BrowserHomeDriver(page);
    this.Tabs = new BrowserTabsDriver(page, world);
  }

  static async start(page: Page): Promise<PiChatBrowserDriver> {
    const world = new TestWorld([], true);
    let server: PiChatServer | undefined;
    try {
      server = createPiChatServer(undefined, resolve("dist/web"), world.factory);
      await new Promise<void>((resolveListen, reject) => {
        server!.httpServer.once("error", reject);
        server!.httpServer.listen(0, "127.0.0.1", () => {
          server!.httpServer.off("error", reject);
          resolveListen();
        });
      });
      const port = (server.httpServer.address() as AddressInfo).port;
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
      const driver = new PiChatBrowserDriver(page, world, async () => {
        await server!.close();
        await world.dispose();
      });
      await driver.Home.ShouldBeVisible();
      return driver;
    } catch (error) {
      await server?.close().catch(() => undefined);
      await world.dispose().catch(() => undefined);
      throw error;
    }
  }

  async WaitUntilReady(): Promise<void> {
    await expect(this.composer).toBeVisible();
    await expect(this.composer).toBeEnabled();
  }

  dispose(): Promise<void> {
    return this.disposed ??= this.cleanup();
  }
}
