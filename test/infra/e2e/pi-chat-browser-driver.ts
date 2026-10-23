import { join, resolve } from "node:path";
import { SessionManager, type ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { AddressInfo } from "node:net";
import { expect, type Locator, type Page } from "@playwright/test";
import { createPiServer, type PiServer, type RestartService } from "@manuelselch/pi-server";
import { TestWorld } from "../pi-chat/test-world.js";
import { BrowserBrowserDriver } from "./browser-browser-driver.js";
import { BrowserChatDriver } from "./browser-chat-driver.js";
import { BrowserHomeDriver } from "./browser-home-driver.js";
import { BrowserTabsDriver } from "./browser-tabs-driver.js";
import { BrowserSkillsDriver } from "./browser-skills-driver.js";
import { BrowserProjectsDriver } from "./browser-projects-driver.js";
import { BrowserSettingsDriver } from "./browser-settings-driver.js";
import { BrowserFocusDriver } from "./browser-focus-driver.js";

/** Visible-browser application driver. Playwright types and selectors stay behind this API. */
export class PiChatBrowserDriver {
  readonly Browser: BrowserBrowserDriver;
  readonly Chat: BrowserChatDriver;
  readonly Home: BrowserHomeDriver;
  readonly Tabs: BrowserTabsDriver;
  readonly Skills: BrowserSkillsDriver;
  readonly Projects: BrowserProjectsDriver;
  readonly Settings: BrowserSettingsDriver;
  readonly Focus: BrowserFocusDriver;
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
    this.Skills = new BrowserSkillsDriver(page, this.composer);
    this.Projects = new BrowserProjectsDriver(page);
    this.Settings = new BrowserSettingsDriver(page);
    this.Focus = new BrowserFocusDriver(page, this.composer, world);
  }

  static async start(page: Page, options: { extensions?: readonly ExtensionFactory[]; restart?: RestartService; projectName?: string } = {}): Promise<PiChatBrowserDriver> {
    const world = new TestWorld(options.extensions, true, options.projectName);
    let server: PiServer | undefined;
    try {
      server = createPiServer({
        staticDirectory: resolve("dist/web"), runtimeFactory: world.factory, restart: options.restart,
        catalogue: {
          lister: { listAll: () => SessionManager.list(world.projectPath, world.sessionDir) },
          sessionsDirectory: world.sessionDir,
          metadataFile: join(world.projectPath, ".pi-chat", "projects.json"),
        },
      });
      await new Promise<void>((resolveListen, reject) => {
        server!.httpServer.once("error", reject);
        server!.httpServer.listen(0, "127.0.0.1", () => {
          server!.httpServer.off("error", reject);
          resolveListen();
        });
      });
      const port = (server.httpServer.address() as AddressInfo).port;
      const driver = new PiChatBrowserDriver(page, world, async () => {
        await server!.close();
        await world.dispose();
      });
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
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
