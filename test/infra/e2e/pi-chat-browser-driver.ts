import { resolve } from "node:path";
import { AddressInfo } from "node:net";
import { expect, type Locator, type Page } from "@playwright/test";
import { createPiChatServer, type PiChatServer } from "../../../src/server/bootstrap/server.js";
import { TestWorld, type AssistantResponse } from "../pi-chat/test-world.js";
import { BrowserChatDriver } from "./browser-chat-driver.js";

export interface PiChatBrowserDriverOptions {
  responses: readonly AssistantResponse[];
}

/** Visible-browser application driver. Playwright types and selectors stay behind this API. */
export class PiChatBrowserDriver {
  readonly Chat: BrowserChatDriver;
  private readonly composer: Locator;
  private disposed?: Promise<void>;

  private constructor(
    private readonly page: Page,
    private readonly cleanup: () => Promise<void>,
  ) {
    this.composer = page.getByRole("textbox", { name: "Message Pi" });
    this.Chat = new BrowserChatDriver(page, this.composer);
  }

  static async start(page: Page, options: PiChatBrowserDriverOptions): Promise<PiChatBrowserDriver> {
    const world = new TestWorld();
    let server: PiChatServer | undefined;
    try {
      const initial = await world.create(options.responses);
      server = createPiChatServer(initial, resolve("dist/web"), world.factory);
      await new Promise<void>((resolveListen, reject) => {
        server!.httpServer.once("error", reject);
        server!.httpServer.listen(0, "127.0.0.1", () => {
          server!.httpServer.off("error", reject);
          resolveListen();
        });
      });
      const port = (server.httpServer.address() as AddressInfo).port;
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
      const driver = new PiChatBrowserDriver(page, async () => {
        await server!.close();
        await world.dispose();
      });
      await driver.WaitUntilReady();
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
