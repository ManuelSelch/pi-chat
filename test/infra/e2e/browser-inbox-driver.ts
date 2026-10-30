import { expect, type Locator, type Page } from "@playwright/test";
import type { TestWorld } from "../pi-chat/test-world.js";
import { pageCoverage } from "./coverage/browser-coverage.js";

export class BrowserInboxDriver {
  constructor(private readonly page: Page, private readonly world: TestWorld) {}
  private panel(): Locator {
    return this.page.getByRole("navigation", { name: "Sessions", exact: true }).or(this.page.getByRole("dialog", { name: "Sessions", exact: true }));
  }
  private later(): Locator { return this.panel().getByRole("button", { name: /^Later/ }); }

  async setEnabled(enabled: boolean): Promise<void> {
    if (!(await this.page.getByRole("button", { name: "Settings", exact: true }).isVisible())) await this.open();
    await this.page.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = this.page.getByRole("dialog", { name: "Settings", exact: true });
    await settings.getByRole("switch", { name: "Show open sessions in sidebar", exact: true }).setChecked(enabled);
    await this.page.keyboard.press("Escape");
    await expect(settings).toHaveCount(0);
    if (enabled) await expect(this.panel()).toBeVisible();
  }
  async open(): Promise<void> {
    if (!(await this.panel().isVisible())) await this.page.getByRole("button", { name: "Sessions", exact: true }).click();
    await expect(this.panel()).toBeVisible();
  }
  async close(): Promise<void> {
    await this.panel().getByRole("button", { name: "Close sessions", exact: true }).click();
    await expect(this.panel()).toHaveCount(0);
  }
  async select(title: string): Promise<void> {
    const release = this.world.reserveSession([]);
    try {
      await this.panel().getByRole("button", { name: `Open ${title}`, exact: true }).click();
      await expect(this.panel().getByRole("button", { name: `Open ${title}`, exact: true })).toHaveAttribute("aria-current", "true");
    } finally { release(); }
  }
  async parkCurrent(): Promise<void> {
    await this.page.getByRole("button", { name: "Move current session to Later", exact: true }).click();
    await expect(this.page.getByRole("button", { name: "Move current session to Later", exact: true })).not.toBeVisible();
  }
  async shouldHaveLater(count: number, expanded = false): Promise<void> {
    await expect(this.later()).toHaveText(`Later${count}`);
    await expect(this.later()).toHaveAttribute("aria-expanded", String(expanded));
  }
  async expandLater(): Promise<void> {
    if (await this.later().getAttribute("aria-expanded") !== "true") await this.later().click();
  }
  async resume(title: string): Promise<void> {
    const release = this.world.reserveSession([]);
    try {
      await this.expandLater();
      await this.panel().getByRole("button", { name: `Resume ${title}`, exact: true }).click();
      await expect(this.page.getByRole("textbox", { name: "Message Pi" })).toBeEnabled();
      await expect(this.panel().getByRole("button", { name: `Open ${title}`, exact: true })).toHaveAttribute("aria-current", "true");
    } finally { release(); }
  }
  async closeView(): Promise<void> {
    await this.page.getByRole("button", { name: "Close current session view", exact: true }).click();
    await this.shouldShowEmptyView();
  }
  async shouldShowEmptyView(): Promise<void> {
    await expect(this.page.getByRole("textbox", { name: "Message Pi" })).not.toBeVisible();
    await expect(this.page.getByRole("textbox", { name: "Search sessions and projects", exact: true })).toBeVisible();
    await expect(this.page.getByRole("main").getByRole("button", { name: "New session", exact: true })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Open folder", exact: true })).toBeVisible();
  }
  async shouldBeInSection(title: string, section: "Working" | "Ready" | "Needs you"): Promise<void> {
    await expect(this.panel().getByRole("region", { name: section, exact: true }).getByRole("button", { name: `Open ${title}`, exact: true })).toBeVisible();
  }
  async finishResponse(title: string): Promise<void> {
    const row = this.panel().getByRole("button", { name: `Open ${title}`, exact: true }).locator("..");
    const id = await row.getAttribute("data-session-inbox-row");
    if (!id) throw new Error("Session runtime is not available");
    const path = await row.getAttribute("data-session-path");
    if (!path) throw new Error("Session path is not available");
    this.world.releaseControlledResponse(path);
    await expect(this.panel().getByRole("region", { name: "Ready", exact: true }).locator(`[data-session-inbox-row="${id}"]`)).toBeVisible();
  }
  async shouldHaveReady(count: number): Promise<void> {
    await expect(this.panel().getByRole("region", { name: "Ready", exact: true }).getByRole("button", { name: /^Open / })).toHaveCount(count);
  }
  async parkReady(title: string): Promise<void> {
    const row = this.panel().getByRole("button", { name: `Open ${title}`, exact: true }).locator("..");
    await row.hover();
    await row.getByRole("button", { name: `Move ${title} to Later`, exact: true }).click();
    await expect(this.panel().getByRole("button", { name: `Open ${title}`, exact: true })).toHaveCount(0);
  }
  async archiveReady(title: string): Promise<void> {
    const row = this.panel().getByRole("button", { name: `Open ${title}`, exact: true }).locator("..");
    await row.hover();
    await row.getByRole("button", { name: `Archive ${title}`, exact: true }).click();
    await expect(this.page.getByRole("button", { name: "Undo archive", exact: true })).toBeVisible();
  }
  async shouldHaveSoundGeometry(title: string): Promise<void> {
    const button = this.panel().getByRole("button", { name: `Open ${title}`, exact: true });
    const row = button.locator("..");
    await row.hover();
    const geometry = await button.evaluate(element => {
      const style = getComputedStyle(element);
      return { width: element.getBoundingClientRect().width, parentWidth: element.parentElement!.getBoundingClientRect().width, paddingX: parseFloat(style.paddingLeft), paddingY: parseFloat(style.paddingTop) };
    });
    expect(geometry.width).toBeGreaterThanOrEqual(geometry.parentWidth - 2);
    expect(geometry.paddingX).toBe(10);
    expect(geometry.paddingY).toBe(8);
    const metadata = await button.locator(":scope > div").first().locator(":scope > *").evaluateAll(elements => elements.map(element => element.getBoundingClientRect()).map(box => ({ left: box.left, right: box.right })));
    expect(metadata).toHaveLength(2);
    expect(metadata[0]!.right).toBeLessThanOrEqual(metadata[1]!.left);
    const titleBox = await button.getByText(title, { exact: true }).boundingBox();
    const actionBox = await row.getByRole("button", { name: `Move ${title} to Later`, exact: true }).boundingBox();
    expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(actionBox!.x);
    const toggles = [this.panel().getByRole("button", { name: /^Working/ }), this.later()];
    for (const toggle of toggles) {
      const widths = await toggle.evaluate(element => ({ width: element.getBoundingClientRect().width, parentWidth: element.parentElement!.getBoundingClientRect().width }));
      expect(widths.width).toBeGreaterThanOrEqual(widths.parentWidth - 2);
    }
  }
  async shouldHaveSoundHeaderGeometry(): Promise<void> {
    const header = this.page.getByRole("banner");
    const branch = header.getByTitle("Branch: fix/a-very-long-branch-name-that-must-truncate-before-controls", { exact: true });
    if (this.page.viewportSize()!.width >= 640) await expect(branch).toBeVisible();
    else await expect(branch).toBeHidden();
    const boxes = await header.locator(":scope > div > *").evaluateAll(elements => elements.map(element => element.getBoundingClientRect()).filter(box => box.width && box.height).map(box => ({ left: box.left, right: box.right })));
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.left).toBeGreaterThanOrEqual(boxes[i - 1]!.right - 1);
    const controls = await header.getByRole("button").evaluateAll(elements => elements.map(element => element.getBoundingClientRect()).filter(box => box.width && box.height).map(box => ({ left: box.left, right: box.right, width: box.width })));
    const viewport = this.page.viewportSize()!;
    for (const box of controls) {
      expect(box.width).toBeGreaterThanOrEqual(22);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(viewport.width);
    }
    for (let i = 1; i < controls.length; i++) expect(controls[i]!.left).toBeGreaterThanOrEqual(controls[i - 1]!.right);
  }
  async shouldPreventParking(): Promise<void> {
    await expect(this.page.getByRole("button", { name: "Move current session to Later", exact: true })).toBeDisabled();
  }
  async archiveLater(title: string): Promise<void> {
    await this.expandLater();
    const row = this.panel().getByRole("button", { name: `Resume ${title}`, exact: true }).locator("..");
    await row.hover();
    await row.getByRole("button", { name: `Archive ${title}`, exact: true }).click();
    await expect(this.page.getByRole("button", { name: "Undo archive", exact: true })).toBeVisible();
  }
  async undoArchiveToLater(): Promise<void> {
    await this.page.getByRole("button", { name: "Undo archive", exact: true }).click();
    await expect(this.page.getByRole("button", { name: "Undo archive", exact: true })).not.toBeVisible();
  }
  async create(): Promise<void> {
    const release = this.world.reserveSession([]);
    try {
      await this.page.getByRole("banner").getByRole("button", { name: "New session", exact: true }).click();
      await expect(this.page.getByRole("textbox", { name: "Message Pi" })).toBeEnabled();
    } finally { release(); }
  }
  async archiveCurrent(): Promise<void> {
    await this.page.getByRole("button", { name: "Archive current session", exact: true }).click();
    await expect(this.page.getByRole("button", { name: "Undo archive", exact: true })).toBeVisible();
  }
  async undoArchive(): Promise<void> {
    const release = this.world.reserveSession([]);
    try {
      await this.page.getByRole("button", { name: "Undo archive", exact: true }).click();
      await expect(this.page.getByRole("textbox", { name: "Message Pi" })).toBeEnabled();
      await expect(this.page.getByRole("button", { name: "Undo archive", exact: true })).not.toBeVisible();
    } finally { release(); }
  }
  async reload(): Promise<void> {
    await pageCoverage.get(this.page)?.checkpoint();
    await this.page.reload({ waitUntil: "networkidle" });
    await expect(this.panel()).toBeVisible();
  }
  async shouldBeDrawer(): Promise<void> { await expect(this.page.getByRole("dialog", { name: "Sessions", exact: true })).toBeVisible(); }
  async openSettings(): Promise<void> {
    await this.panel().getByRole("button", { name: "Settings", exact: true }).click();
    await expect(this.page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
    await expect(this.page.getByRole("dialog", { name: "Sessions", exact: true })).toHaveCount(0);
  }
  async search(query: string): Promise<void> { await this.panel().getByRole("textbox", { name: "Search sessions", exact: true }).fill(query); }
}
