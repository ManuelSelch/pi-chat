import { expect, type Locator, type Page } from "@playwright/test";
import { basename } from "node:path";
import type { TestWorld } from "../pi-chat/test-world.js";

/** Assertions use the rendered panel; no catalogue or socket state is mocked. */
export class BrowserProjectsDriver {
  private readonly panel: Locator;

  private chatBounds?: { x: number; width: number };

  constructor(private readonly page: Page, private readonly world: TestWorld) {
    this.panel = page.getByRole("dialog", { name: "Projects", exact: true }).or(page.getByRole("navigation", { name: "Projects", exact: true }));
  }

  async open(): Promise<void> {
    if (!await this.panel.isVisible()) await this.page.getByRole("button", { name: "Projects and sessions", exact: true }).click();
    await expect(this.panel).toBeVisible();
  }

  async close(): Promise<void> {
    await this.panel.getByRole("button", { name: "Close projects", exact: true }).click();
    await expect(this.panel).not.toBeVisible();
  }

  async shouldBeSidebar(): Promise<void> {
    await expect(this.page.getByRole("navigation", { name: "Projects", exact: true })).toBeVisible();
    await expect(this.page.getByRole("dialog", { name: "Projects", exact: true })).toHaveCount(0);
    await expect(this.page.locator("body")).not.toHaveAttribute("data-scroll-locked");
  }

  async shouldBeDrawer(): Promise<void> {
    const drawer = this.page.getByRole("dialog", { name: "Projects", exact: true });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("aria-modal", "true");
    await expect(this.page.getByRole("navigation", { name: "Projects", exact: true })).toHaveCount(0);
    await expect.poll(() => drawer.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }

  async shouldKeepFocusInSidebar(): Promise<void> {
    await expect.poll(() => this.panel.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }

  async rememberChatBounds(): Promise<void> {
    const form = this.page.locator("form").filter({ has: this.page.getByRole("textbox", { name: "Message Pi" }) });
    const bounds = await form.boundingBox();
    expect(bounds).not.toBeNull();
    this.chatBounds = bounds!;
  }

  async shouldKeepChatBounds(): Promise<void> {
    expect(this.chatBounds).toBeDefined();
    const expected = this.chatBounds!;
    const form = this.page.locator("form").filter({ has: this.page.getByRole("textbox", { name: "Message Pi" }) });
    await expect.poll(async () => {
      const bounds = await form.boundingBox();
      return bounds && Math.abs(bounds.x - expected.x) < 1 && Math.abs(bounds.width - expected.width) < 1;
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
    await this.panel.getByRole("button", { name: title, exact: true }).click();
    await expect(this.panel).toBeVisible();
  }

  async createSession(): Promise<void> {
    const release = this.world.reserveSession([]);
    try {
      await this.panel.getByRole("button", { name: `New session in ${basename(this.world.projectPath)}`, exact: true }).click();
      await expect(this.page.getByRole("textbox", { name: "Message Pi" })).toBeEnabled();
      await expect(this.panel).toBeVisible();
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

  async pin(): Promise<void> {
    await this.panel.getByRole("button", { name: /^Pin / }).click();
  }

  async unpin(): Promise<void> {
    await this.panel.getByRole("button", { name: /^Unpin / }).click();
  }

  async shouldBePinned(): Promise<void> {
    await expect(this.panel.getByRole("button", { name: /^Unpin / })).toBeEnabled();
    await expect(this.panel.getByRole("button", { name: /^Pin / })).toHaveCount(0);
  }

  async shouldBeUnpinned(): Promise<void> {
    await expect(this.panel.getByRole("button", { name: /^Pin / })).toBeEnabled();
    await expect(this.panel.getByRole("button", { name: /^Unpin / })).toHaveCount(0);
  }

  async archive(title: string): Promise<void> {
    await this.panel.getByRole("button", { name: title, exact: true }).hover();
    await this.panel.getByRole("button", { name: `Archive ${title}`, exact: true }).click();
  }

  async shouldShowActiveSession(title: string): Promise<void> {
    await expect(this.panel.getByRole("button", { name: title, exact: true })).toBeVisible();
    await expect(this.panel.getByRole("button", { name: `Archive ${title}`, exact: true })).toBeEnabled();
    await expect(this.panel.getByRole("button", { name: `Restore ${title}`, exact: true })).toHaveCount(0);
  }

  async shouldNotShowSession(title: string): Promise<void> {
    await expect(this.panel.getByRole("button", { name: title, exact: true })).toHaveCount(0);
    await expect(this.panel.getByRole("button", { name: `Archive ${title}`, exact: true })).toHaveCount(0);
  }

  async shouldHideArchivedSection(): Promise<void> {
    await expect(this.panel.getByRole("button", { name: /^Archived/ })).toHaveCount(0);
  }

  async showArchivedSessions(): Promise<void> {
    const toggle = this.panel.getByRole("button", { name: /^Archived/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }

  async shouldShowArchivedSession(title: string): Promise<void> {
    await expect(this.panel.getByRole("button", { name: title, exact: true })).toBeVisible();
    await expect(this.panel.getByRole("button", { name: `Restore ${title}`, exact: true })).toBeEnabled();
    await expect(this.panel.getByRole("button", { name: `Archive ${title}`, exact: true })).toHaveCount(0);
  }
}
