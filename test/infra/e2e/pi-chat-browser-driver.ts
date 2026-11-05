import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { rmdirSync } from "node:fs";
import { type ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { AddressInfo } from "node:net";
import { expect, type Locator, type Page } from "@playwright/test";
import { createPiServer, type PiServer, type RestartService } from "@manuelselch/pi-server";
import { TestWorld } from "../pi-chat/test-world.js";
import { BrowserBrowserDriver } from "./browser-browser-driver.js";
import { BrowserChatDriver } from "./browser-chat-driver.js";
import { BrowserHomeDriver } from "./browser-home-driver.js";
import { BrowserTabsDriver } from "./browser-tabs-driver.js";
import { BrowserSkillsDriver } from "./browser-skills-driver.js";
import { BrowserInboxDriver } from "./browser-inbox-driver.js";
import { BrowserProjectsDriver } from "./browser-projects-driver.js";
import { BrowserSettingsDriver } from "./browser-settings-driver.js";
import { QuickOpenFolderPathDriver } from "./quick-open-folder-path-driver.js";
import { BrowserPromptsDriver } from "./browser-prompts-driver.js";
import { BrowserFocusDriver } from "./browser-focus-driver.js";
import { BrowserThemeDriver } from "./browser-theme-driver.js";
import { BrowserWidgetsDriver } from "./browser-widgets-driver.js";
import { BrowserExtensionsDriver } from "./browser-extensions-driver.js";
import { WidgetExtensionFixture } from "../pi-chat/fixtures/widget-extension-fixture.js";

/** Visible-browser application driver. Playwright types and selectors stay behind this API. */
export class PiChatBrowserDriver {
  readonly browser: BrowserBrowserDriver;
  readonly theme: BrowserThemeDriver;
  readonly chat: BrowserChatDriver;
  readonly home: BrowserHomeDriver;
  readonly tabs: BrowserTabsDriver;
  readonly skills: BrowserSkillsDriver;
  readonly projects: BrowserProjectsDriver;
  readonly inbox: BrowserInboxDriver;
  readonly settings: BrowserSettingsDriver;
  readonly quickOpen: QuickOpenFolderPathDriver;
  readonly focus: BrowserFocusDriver;
  readonly prompts: BrowserPromptsDriver;
  readonly widgets: BrowserWidgetsDriver;
  readonly extensions: BrowserExtensionsDriver;
  private readonly composer: Locator;
  private disposed?: Promise<void>;

  private constructor(
    private readonly page: Page,
    private readonly world: TestWorld,
    widgetFixture: WidgetExtensionFixture,
    private readonly cleanup: () => Promise<void>,
    private readonly restartBackendService: () => Promise<void>,
  ) {
    this.composer = page.getByRole("textbox", { name: "Message Pi" });
    this.browser = new BrowserBrowserDriver(page);
    this.theme = new BrowserThemeDriver(page);
    this.chat = new BrowserChatDriver(page, this.composer);
    this.home = new BrowserHomeDriver(page);
    this.tabs = new BrowserTabsDriver(page, world);
    this.skills = new BrowserSkillsDriver(page, this.composer);
    this.projects = new BrowserProjectsDriver(page, world);
    this.inbox = new BrowserInboxDriver(page, world);
    this.settings = new BrowserSettingsDriver(page);
    this.quickOpen = new QuickOpenFolderPathDriver(page, world);
    this.focus = new BrowserFocusDriver(page, this.composer, world);
    this.prompts = new BrowserPromptsDriver(page);
    this.extensions = new BrowserExtensionsDriver(widgetFixture);
    this.widgets = new BrowserWidgetsDriver(page, this.extensions);
  }

  static async start(page: Page, options: { extensions?: readonly ExtensionFactory[]; restart?: RestartService; projectName?: string; repositoryName?: string; projectBranch?: string; linkedWorktree?: boolean; probeThemeReconnect?: boolean; inboxEnabled?: boolean } = {}): Promise<PiChatBrowserDriver> {
    const widgetFixture = new WidgetExtensionFixture();
    const world = new TestWorld([...(options.extensions ?? []), widgetFixture.extension], true, options.projectName);
    let server: PiServer | undefined;
    try {
      if (options.linkedWorktree && (!options.projectName || !options.projectBranch || !options.repositoryName)) throw new Error("Linked fixtures require an isolated checkout name, repository name and branch");
      if (options.repositoryName && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.repositoryName) || options.repositoryName === options.projectName)) throw new Error("Fixture repository name must be a safe directory name distinct from the checkout");
      if (options.projectBranch) {
        const repository = options.linkedWorktree ? resolve(world.projectPath, "..", options.repositoryName!) : world.projectPath;
        execFileSync("git", ["init", "--initial-branch", options.linkedWorktree ? "main" : options.projectBranch, repository], { stdio: "ignore" });
        execFileSync("git", ["-C", repository, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "Fixture"], { stdio: "ignore" });
        if (options.linkedWorktree) {
          rmdirSync(world.projectPath); // Empty, test-owned directory; never remove recursively.
          execFileSync("git", ["-C", repository, "worktree", "add", "-b", options.projectBranch, world.projectPath], { stdio: "ignore" });
        }
      }
      const createServer = () => createPiServer({
        staticDirectory: resolve("dist/web"), runtimeFactory: world.factory, restart: options.restart,
        catalogue: {
          lister: { listAll: () => world.listSessions() },
          sessionsDirectory: world.sessionDir,
          metadataFile: join(world.projectPath, ".pi-chat", "projects.json"),
        },
      });
      server = createServer();
      const listen = (port: number) => new Promise<void>((resolveListen, reject) => {
        server!.httpServer.once("error", reject);
        server!.httpServer.listen(port, "127.0.0.1", () => {
          server!.httpServer.off("error", reject);
          resolveListen();
        });
      });
      await listen(0);
      const port = (server.httpServer.address() as AddressInfo).port;
      const driver = new PiChatBrowserDriver(page, world, widgetFixture, async () => {
        world.resumeCatalogueScans();
        await server!.close();
        await world.dispose();
      }, async () => {
        await server!.close();
        server = createServer();
        await listen(port);
      });
      if (options.inboxEnabled !== undefined) {
        await page.addInitScript((enabled: boolean) => {
          if (localStorage.getItem("pi-chat:session-inbox") === null) localStorage.setItem("pi-chat:session-inbox", JSON.stringify(enabled));
        }, options.inboxEnabled);
      }
      if (options.probeThemeReconnect) await driver.theme.prepareReconnectProbe();
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
      await driver.home.shouldBeVisible();
      return driver;
    } catch (error) {
      await server?.close().catch(() => undefined);
      await world.dispose().catch(() => undefined);
      throw error;
    }
  }

  async restartBackend(): Promise<void> {
    await this.restartBackendService();
    await this.inbox.reload();
    await this.inbox.shouldShowHome();
  }

  async waitUntilReady(): Promise<void> {
    await expect(this.composer).toBeVisible();
    await expect(this.composer).toBeEnabled();
  }

  dispose(): Promise<void> {
    return this.disposed ??= this.cleanup();
  }
}
