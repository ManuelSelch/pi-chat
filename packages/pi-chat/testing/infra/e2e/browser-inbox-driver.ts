import { expect, type Locator, type Page } from "@playwright/test";
import type { AssistantResponse, TestWorld } from "../pi-chat/test-world.js";
import { worktreeLabel } from "../../../src/web/features/sessions/utils/worktree-label.js";
import { pageCoverage } from "./coverage/browser-coverage.js";

export class BrowserInboxDriver {
  constructor(private readonly page: Page, private readonly world: TestWorld) {}
  private panel(): Locator {
    return this.page.getByRole("navigation", { name: "Sessions", exact: true }).or(this.page.getByRole("dialog", { name: "Sessions", exact: true }));
  }
  private later(): Locator { return this.panel().getByRole("button", { name: /^Later/ }); }

  async shouldUseSidebar(): Promise<void> {
    await expect(this.page.getByRole("banner").getByRole("button", { name: "Sessions", exact: true })).toBeVisible();
    await expect(this.panel()).toBeVisible();
  }
  async shouldHaveHeaderSessionActions(visible: boolean): Promise<void> {
    const header = this.page.getByRole("banner");
    for (const name of ["Move current session to Later", "Archive current session"]) {
      const action = header.getByRole("button", { name, exact: true });
      if (visible) {
        await expect(action).toBeVisible();
        await expect(action).toBeEnabled();
      } else await expect(action).toHaveCount(0);
    }
    await expect(header.getByRole("button", { name: "Close current session view", exact: true })).toBeEnabled();
  }
  async shouldHaveUnbrandedHeader(): Promise<void> {
    const header = this.page.getByRole("banner");
    await expect(header.getByText("Pi Chat", { exact: true })).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Sessions", exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: "New session", exact: true })).toBeVisible();
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
    await this.shouldShowHome();
  }
  async shouldShowHome(): Promise<void> {
    await expect(this.page.getByRole("textbox", { name: "Message Pi" })).not.toBeVisible();
    await expect(this.page.getByRole("textbox", { name: "Search sessions and projects", exact: true })).toBeVisible();
    await expect(this.page.getByRole("main").getByRole("button", { name: "New session", exact: true })).toHaveCount(0);
    await expect(this.page.getByRole("main").getByRole("button", { name: "Open folder", exact: true })).toHaveCount(0);
  }
  async shouldHaveStatus(title: string, status: "Working" | "Ready" | "Needs you"): Promise<void> {
    const row = this.panel().getByRole("button", { name: `Open ${title}`, exact: true });
    await expect(row).toBeVisible();
    await expect(row.getByRole("img", { name: status, exact: true })).toBeVisible();
  }
  async shouldHaveStatusCount(status: "Working" | "Ready" | "Needs you", count: number): Promise<void> {
    await expect(this.panel().getByRole("button", { name: /^Open / }).filter({ has: this.page.getByRole("img", { name: status, exact: true }) })).toHaveCount(count);
  }
  async goHome(): Promise<void> {
    await this.closeView();
  }
  async shouldHaveNoPageNavigation(): Promise<void> {
    await expect(this.panel().getByRole("button", { name: "Home", exact: true })).toHaveCount(0);
    await expect(this.panel().getByRole("button", { name: /^Inbox/ })).toHaveCount(0);
  }
  async searchHome(query: string): Promise<void> {
    await this.page.getByRole("textbox", { name: "Search sessions and projects", exact: true }).fill(query);
  }
  async shouldShowSearchResult(title: string): Promise<void> {
    await expect(this.page.getByRole("main").getByRole("option", { name: new RegExp(title) })).toBeVisible();
    await expect(this.page.getByRole("main").getByRole("region", { name: "Ready", exact: true })).toBeVisible();
  }
  async shouldShowHomeActivity(titles: readonly string[], excluded: readonly string[] = []): Promise<void> {
    const main = this.page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Lets cook", exact: true })).toBeVisible();
    await expect(main.getByRole("textbox", { name: "Search sessions and projects", exact: true })).toBeVisible();
    for (const title of titles) await expect(main.getByRole("button", { name: `Open ${title}`, exact: true })).toBeVisible();
    for (const title of excluded) await expect(main.getByRole("button", { name: `Open ${title}`, exact: true })).toHaveCount(0);
    await expect(this.page.getByRole("textbox", { name: "Message Pi" })).not.toBeVisible();
    await expect(this.page.getByRole("banner").getByRole("button", { name: "New session", exact: true })).toBeVisible();
  }
  async openFromInbox(title: string): Promise<void> {
    const release = this.world.reserveSession([]);
    try {
      await this.page.getByRole("main").getByRole("button", { name: `Open ${title}`, exact: true }).click();
      await expect(this.page.getByRole("textbox", { name: "Message Pi" })).toBeEnabled();
    } finally { release(); }
  }
  async parkFromInbox(title: string): Promise<void> {
    await this.page.getByRole("main").getByRole("button", { name: `Move ${title} to Later`, exact: true }).click();
    await expect(this.page.getByRole("main").getByRole("button", { name: `Open ${title}`, exact: true })).toHaveCount(0);
  }
  async finishResponse(title: string): Promise<void> {
    const row = this.panel().getByRole("button", { name: `Open ${title}`, exact: true }).locator("..");
    const id = await row.getAttribute("data-session-inbox-row");
    if (!id) throw new Error("Session runtime is not available");
    const path = await row.getAttribute("data-session-path");
    if (!path) throw new Error("Session path is not available");
    this.world.releaseControlledResponse(path);
    await this.shouldHaveStatus(title, "Ready");
  }
  async shouldHaveReady(count: number): Promise<void> {
    await this.shouldHaveStatusCount("Ready", count);
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
    await expect(this.panel().getByRole("button", { name: `Open ${title}`, exact: true })).toHaveCount(0);
  }
  async shouldHaveSoundGeometry(title: string, expectations: { working: boolean; later: boolean }): Promise<void> {
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
    for (let i = 1; i < metadata.length; i++) expect(metadata[i - 1]!.right).toBeLessThanOrEqual(metadata[i]!.left);
    const titleBox = await button.getByText(title, { exact: true }).boundingBox();
    const actionBox = await row.getByRole("button", { name: `Move ${title} to Later`, exact: true }).boundingBox();
    expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(actionBox!.x);
    const toggles = [
      { control: this.later(), expected: expectations.later },
    ];
    for (const { control, expected } of toggles) {
      if (!expected) {
        await expect(control).toHaveCount(0);
        continue;
      }
      const widths = await control.evaluate(element => ({ width: element.getBoundingClientRect().width, parentWidth: element.parentElement!.getBoundingClientRect().width }));
      expect(widths.width).toBeGreaterThanOrEqual(widths.parentWidth - 2);
    }
  }
  async shouldShowHeaderWorktree(branch: string, title: string): Promise<void> {
    const header = this.page.getByRole("banner");
    await expect(header.getByText(branch, { exact: true })).toBeVisible();
    await expect(header.getByText(title, { exact: true })).toHaveCount(0);
    await expect(header.getByTitle(`Branch: ${branch}`, { exact: true })).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Go to Home", exact: true })).toHaveCount(0);
  }
  async shouldShowWorktreeSession(repositoryName: string, branch: string): Promise<void> {
    const button = this.panel().getByRole("button").filter({ has: this.page.getByText(worktreeLabel(branch), { exact: true }) });
    await expect(button).toHaveCount(1);
    await expect(button).toBeVisible();
    await expect(this.panel().getByRole("region", { name: repositoryName, exact: true }).getByRole("button").filter({ has: this.page.getByText(worktreeLabel(branch), { exact: true }) })).toBeVisible();
    await expect(button.getByText(repositoryName, { exact: true })).toHaveCount(0);
    await expect(button.getByText("New session", { exact: true })).toHaveCount(0);
  }
  async shouldShowProjectName(title: string, projectName: string, later = false): Promise<void> {
    const button = this.panel().getByRole("button", { name: `${later ? "Resume" : "Open"} ${title}`, exact: true });
    if (later) await expect(button.getByText(projectName, { exact: true })).toBeVisible();
    else {
      await expect(this.panel().getByRole("region", { name: projectName, exact: true }).getByRole("button", { name: `Open ${title}`, exact: true })).toBeVisible();
      await expect(button.getByText(projectName, { exact: true })).toHaveCount(0);
    }
  }
  async shouldShowCompactWorktreeLabels(title: string, branch: string, later = false): Promise<void> {
    const button = this.panel().getByRole("button", { name: `${later ? "Resume" : "Open"} ${title}`, exact: true });
    await expect(button).not.toHaveAttribute("title");
    await expect(button.getByText(worktreeLabel(branch), { exact: true })).toBeVisible();
    await expect(button.getByText(title, { exact: true })).toHaveCount(0);
    await expect(button.locator(":scope > div")).toHaveCount(1);
    const primary = button.getByText(worktreeLabel(branch), { exact: true });
    await expect(primary.locator("..").getByRole("img", { name: /^(Ready|Working|Needs you)$/ })).toBeVisible();
    await expect(button.getByText(/^(just now|\d+[mhd])$/)).toHaveCount(0);
    const row = button.locator("..");
    const archive = row.getByRole("button", { name: `Archive ${title}`, exact: true });
    if (await archive.count()) {
      await row.hover();
      const primaryBox = await button.getByText(worktreeLabel(branch), { exact: true }).boundingBox();
      const actionBox = await archive.boundingBox();
      expect(primaryBox!.x + primaryBox!.width).toBeLessThanOrEqual(actionBox!.x);
    }
  }
  async shouldShowWorktreeLabels(title: string, branch: string, later = false): Promise<void> {
    const button = this.panel().getByRole("button", { name: `${later ? "Resume" : "Open"} ${title}`, exact: true });
    const primary = button.getByText(worktreeLabel(branch), { exact: true });
    const secondary = button.locator("p").getByText(title, { exact: true });
    await expect(primary).toBeVisible();
    await expect(secondary).toBeVisible();
    // Responsive drawer replacement can detach nodes between visibility and style reads.
    await expect.poll(async () => {
      const primarySize = await primary.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
      const secondarySize = await secondary.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
      return primarySize - secondarySize;
    }).toBeGreaterThan(0);
    const primaryBox = await primary.boundingBox();
    const secondaryBox = await secondary.boundingBox();
    const secondaryPaddingLeft = await secondary.evaluate(element => parseFloat(getComputedStyle(element).paddingLeft));
    expect(primaryBox!.x).toBe(secondaryBox!.x + secondaryPaddingLeft);
    await expect(primary.locator("..").getByRole("img", { name: /^(Ready|Working|Needs you)$/ })).toBeVisible();
    const row = button.locator("..");
    const archive = row.getByRole("button", { name: `Archive ${title}`, exact: true });
    if (await archive.count()) {
      await row.hover();
      const hoveredPrimary = await primary.boundingBox();
      const actionBox = await archive.boundingBox();
      expect(hoveredPrimary!.x + hoveredPrimary!.width).toBeLessThanOrEqual(actionBox!.x);
      expect(Math.abs((hoveredPrimary!.y + hoveredPrimary!.height / 2) - (actionBox!.y + actionBox!.height / 2))).toBeLessThanOrEqual(1);
      expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(secondaryBox!.y + 1);
    }
  }
  async shouldHideRunningActions(title: string): Promise<void> {
    const button = this.panel().getByRole("button", { name: `Open ${title}`, exact: true });
    const row = button.locator("..");
    await row.hover();
    await expect(row.getByRole("button", { name: `Move ${title} to Later`, exact: true })).toHaveCount(0);
    await expect(row.getByRole("button", { name: `Archive ${title}`, exact: true })).toHaveCount(0);
    const padding = await button.locator(":scope > div").first().evaluate(element => parseFloat(getComputedStyle(element).paddingRight));
    expect(padding).toBe(0);
  }
  async shouldHaveTightProjectHeadings(expectations: { working: boolean; later: boolean }): Promise<void> {
    const headings = [
      { heading: this.panel().getByRole("region").first().getByRole("button").first(), expected: true },
      { heading: this.later(), expected: expectations.later },
    ];
    for (const { heading, expected } of headings) {
      if (!expected) {
        await expect(heading).toHaveCount(0);
        continue;
      }
      expect(await heading.evaluate(element => parseFloat(getComputedStyle(element).paddingLeft))).toBe(2);
    }
  }
  async shouldHaveSoundHeaderGeometry(): Promise<void> {
    const header = this.page.getByRole("banner");
    await expect(header.getByTitle("Branch: fix/a-very-long-branch-name-that-must-truncate-before-controls", { exact: true })).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Go to Home", exact: true })).toHaveCount(0);
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
    await expect(this.panel().getByRole("button", { name: `Resume ${title}`, exact: true })).toHaveCount(0);
  }
  async create(options: { responses: readonly AssistantResponse[] } = { responses: [] }): Promise<void> {
    const release = this.world.reserveSession(options.responses);
    try {
      await this.page.getByRole("banner").getByRole("button", { name: "New session", exact: true }).click();
      await expect(this.page.getByRole("textbox", { name: "Message Pi" })).toBeEnabled();
    } finally { release(); }
  }
  async archiveCurrent(): Promise<void> {
    await this.page.getByRole("button", { name: "Archive current session", exact: true }).click();
    await expect(this.page.getByRole("button", { name: "Archive current session", exact: true })).toHaveCount(0);
  }
  async shouldHaveNoArchiveNotice(): Promise<void> {
    await expect(this.page.getByRole("status").filter({ hasText: "Session archived." })).toHaveCount(0);
    await expect(this.page.getByRole("button", { name: "Undo archive", exact: true })).toHaveCount(0);
  }
  async reload(): Promise<void> {
    await pageCoverage.get(this.page)?.checkpoint();
    await this.page.reload({ waitUntil: "networkidle" });
    await expect(this.page.getByRole("banner")).toBeVisible();
    await expect(this.panel()).toBeVisible();
  }
  async shouldBeDrawer(): Promise<void> { await expect(this.page.getByRole("dialog", { name: "Sessions", exact: true })).toBeVisible(); }
  async openSettings(): Promise<void> {
    await this.panel().getByRole("button", { name: "Settings", exact: true }).click();
    await expect(this.page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
    await expect(this.page.getByRole("dialog", { name: "Sessions", exact: true })).toHaveCount(0);
  }
  async shouldHaveNoSearch(): Promise<void> {
    await expect(this.panel().getByRole("textbox", { name: "Search sessions", exact: true })).toHaveCount(0);
  }
  async shouldNotShowSession(title: string): Promise<void> {
    await expect(this.panel().getByRole("button", { name: new RegExp(`^(Open|Resume) ${title}$`) })).toHaveCount(0);
    await expect(this.panel().getByRole("button", { name: /^Archived/ })).toHaveCount(0);
  }
  async shouldHideLater(): Promise<void> {
    await expect(this.later()).toHaveCount(0);
  }
}
