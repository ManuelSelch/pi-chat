import assert from "node:assert/strict";
import { expect, type Locator, type Page } from "@playwright/test";
import type { AssistantResponse, TestSessionResources, TestWorld } from "../pi-chat/test-world.js";

const handleBrand = Symbol("PiChatBrowserSession");
export interface BrowserSessionHandle { readonly [handleBrand]: true }
export interface CreateBrowserSessionOptions extends TestSessionResources {
  responses: readonly AssistantResponse[];
}

/** Session identity comes from rendered sidebar rows, never from their order. */
export class BrowserSessionsDriver {
  private readonly ids = new WeakMap<BrowserSessionHandle, string>();

  constructor(private readonly page: Page, private readonly world: TestWorld) {}

  private panel(): Locator {
    return this.page.getByRole("navigation", { name: "Sessions", exact: true }).or(this.page.getByRole("dialog", { name: "Sessions", exact: true }));
  }
  private rows(): Locator { return this.panel().locator("[data-session-id]"); }
  private row(handle: BrowserSessionHandle): Locator {
    const id = this.ids.get(handle);
    assert(id, "Session belongs to another application or is not a valid handle");
    return this.panel().locator(`[data-session-id="${id}"]`);
  }
  private async openNavigation(): Promise<void> {
    if (!await this.panel().isVisible()) await this.page.getByRole("button", { name: "Sessions", exact: true }).click();
    await expect(this.panel()).toBeVisible();
  }
  private async closePhoneNavigation(): Promise<void> {
    const drawer = this.page.getByRole("dialog", { name: "Sessions", exact: true });
    if (await drawer.isVisible()) {
      await drawer.getByRole("button", { name: "Close sessions", exact: true }).click();
      await expect(drawer).toHaveCount(0);
    }
  }

  async create(options: CreateBrowserSessionOptions): Promise<BrowserSessionHandle> {
    await this.closePhoneNavigation();
    const release = this.world.reserveSession(options.responses, options);
    try {
      const homeSearch = this.page.getByRole("main").getByRole("textbox", { name: "Search sessions and projects" });
      if (await homeSearch.isVisible()) await homeSearch.press("Enter");
      else await this.page.getByRole("banner").getByRole("button", { name: "New session", exact: true }).click();
      const composer = this.page.getByRole("textbox", { name: "Message Pi" });
      await expect(composer).toBeVisible();
      await expect(composer).toBeEnabled();
      await expect(composer).not.toHaveAttribute("aria-busy", "true");
      await expect(this.page.getByText("Opening…", { exact: true })).not.toBeVisible();
      await expect(this.page.getByText("Connecting…", { exact: true })).not.toBeVisible();
      await this.openNavigation();
      const selected = this.rows().filter({ has: this.page.locator('button[aria-current="true"]') });
      await expect(selected).toHaveCount(1);
      const id = await selected.getAttribute("data-session-id");
      assert(id, "New session must have a runtime identity");
      const handle = Object.freeze({ [handleBrand]: true as const });
      this.ids.set(handle, id);
      await this.closePhoneNavigation();
      return handle;
    } finally { release(); }
  }

  async switchTo(handle: BrowserSessionHandle): Promise<void> {
    await this.openNavigation();
    const id = this.ids.get(handle);
    assert(id, "Unknown session handle");
    await this.panel().locator(`[data-session-id="${id}"]`).getByRole("button", { name: /^Open / }).click();
    await this.shouldBeSelected(handle);
    await this.closePhoneNavigation();
  }
  async changeLiveTitleWhileCatalogueIsStale(title: string): Promise<void> {
    this.world.pauseCatalogueScans();
    this.world.sessionTitle.setTitle(title);
    await expect.poll(() => this.world.catalogueScanBlocked).toBe(true);
    await expect(this.page.getByRole("banner").getByText(title, { exact: true })).toBeVisible();
  }
  async shouldBeSelected(handle: BrowserSessionHandle): Promise<void> {
    await this.openNavigation();
    await expect(this.row(handle).getByRole("button", { name: /^Open / })).toHaveAttribute("aria-current", "true");
    await this.closePhoneNavigation();
  }
  async shouldHaveCount(count: number): Promise<void> {
    await this.openNavigation();
    await expect(this.rows()).toHaveCount(count);
    await this.closePhoneNavigation();
  }
  async close(handle: BrowserSessionHandle): Promise<void> {
    await this.switchTo(handle);
    await this.page.getByRole("button", { name: "Close current session view", exact: true }).click();
    await expect(this.page.getByRole("textbox", { name: "Search sessions and projects" })).toBeVisible();
  }
}
