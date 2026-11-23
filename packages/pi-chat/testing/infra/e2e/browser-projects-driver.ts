import { expect, type Locator, type Page } from "@playwright/test";
import type { TestWorld } from "../pi-chat/test-world.js";

/** Assertions use the rendered panel; no catalogue or socket state is mocked. */
export class BrowserProjectsDriver {
  private readonly panel: Locator;

  constructor(private readonly page: Page, private readonly world: TestWorld) {
    this.panel = page.getByRole("dialog", { name: "Sessions", exact: true }).or(page.getByRole("navigation", { name: "Sessions", exact: true }));
  }

  async open(): Promise<void> {
    if (!await this.panel.isVisible()) await this.page.getByRole("button", { name: "Sessions", exact: true }).click();
    await expect(this.panel).toBeVisible();
  }

  async close(): Promise<void> {
    await this.panel.getByRole("button", { name: "Close sessions", exact: true }).click();
    await expect(this.panel).not.toBeVisible();
  }

  async shouldBeSidebar(): Promise<void> {
    await expect(this.page.getByRole("navigation", { name: "Sessions", exact: true })).toBeVisible();
    await expect(this.page.getByRole("dialog", { name: "Sessions", exact: true })).toHaveCount(0);
    await expect(this.page.locator("body")).not.toHaveAttribute("data-scroll-locked");
  }

  async shouldBeDrawer(): Promise<void> {
    const drawer = this.page.getByRole("dialog", { name: "Sessions", exact: true });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("aria-modal", "true");
    await expect(this.page.getByRole("navigation", { name: "Sessions", exact: true })).toHaveCount(0);
    await expect.poll(() => drawer.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }

  async shouldKeepFocusInSidebar(): Promise<void> {
    await expect.poll(() => this.panel.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }

  async shouldCenterWorkspace(page: "home" | "transcript"): Promise<void> {
    const content = page === "home" ? this.page.getByRole("heading", { name: "Lets cook" }) : this.page.getByRole("main").locator(".mantine-Container-root").first();
    const composer = this.page.locator("form").filter({ has: this.page.getByRole("textbox", { name: "Message Pi" }) });
    await expect.poll(async () => {
      const panel = await this.panel.boundingBox();
      const column = await content.boundingBox();
      const form = page === "transcript" ? await composer.boundingBox() : null;
      const viewport = this.page.viewportSize();
      if (!panel || !column || !viewport || (page === "transcript" && !form)) return false;
      const center = (panel.x + panel.width + viewport.width) / 2;
      return Math.abs(column.x + column.width / 2 - center) < 2 && (!form || Math.abs(form.x + form.width / 2 - center) < 2);
    }).toBe(true);
  }

  async shouldNotOverlapWorkspace(): Promise<void> {
    await expect.poll(async () => {
      const panel = await this.panel.boundingBox();
      const composer = await this.page.getByRole("textbox", { name: "Message Pi" }).boundingBox();
      const transcript = await this.page.getByRole("main").locator(".mantine-Container-root").first().boundingBox();
      const dockLocator = this.page.getByLabel("Extension panels", { exact: true });
      const dock = await dockLocator.count() ? await dockLocator.boundingBox() : null;
      if (!panel || !composer || !transcript) return false;
      return panel.x + panel.width <= composer.x && panel.x + panel.width <= transcript.x
        && (!dock || dock.x >= transcript.x + transcript.width);
    }).toBe(true);
  }

  async selectSession(title: string): Promise<void> {
    await this.panel.getByRole("button", { name: `Open ${title}`, exact: true }).click();
    await expect(this.panel).toBeVisible();
  }

  async createSession(): Promise<void> {
    const release = this.world.reserveSession([]);
    try {
      const drawer = this.page.getByRole("dialog", { name: "Sessions", exact: true });
      const phone = await drawer.isVisible();
      if (phone) await this.close();
      await this.page.getByRole("banner").getByRole("button", { name: "New session", exact: true }).click();
      await expect(this.page.getByRole("textbox", { name: "Message Pi" })).toBeEnabled();
      await this.open();
    } finally { release(); }
  }

  async shouldAllowTranscriptScroll(): Promise<void> {
    const start = await this.page.evaluate(() => window.scrollY);
    const composer = await this.page.getByRole("textbox", { name: "Message Pi" }).boundingBox();
    expect(composer).not.toBeNull();
    await this.page.mouse.move(composer!.x + composer!.width / 2, 200);
    await this.page.mouse.wheel(0, start > 0 ? -400 : 400);
    await expect.poll(() => this.page.evaluate(() => window.scrollY)).not.toBe(start);
    await expect(this.panel).toBeVisible();
  }

}
