import { expect, type Page } from "@playwright/test";
import type { TestWorld } from "../pi-chat/test-world.js";

export class QuickOpenFolderPathDriver {
  constructor(private readonly page: Page, private readonly world: TestWorld) {}

  private input() {
    return this.page.getByRole("textbox", { name: /^(Search folders, worktrees, sessions and actions|Search sessions and projects)$/ });
  }

  async close(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.page.getByRole("listbox", { name: "Folders, worktrees, sessions and actions" })).not.toBeVisible();
  }

  async open(): Promise<void> {
    await this.page.keyboard.press("Meta+o");
    await expect(this.input()).toBeFocused();
  }

  private session(title: string) {
    return this.page.getByRole("option").filter({ has: this.page.getByText(title, { exact: true }) });
  }
  async shouldShowWorktreeSession(repositoryName: string, branch: string): Promise<void> {
    const result = this.page.getByRole("option").filter({ has: this.page.getByText(branch, { exact: true }) });
    await expect(result).toHaveCount(1);
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute("aria-label", /^Session:/);
    await expect(result).toContainText(repositoryName);
    await expect(result).not.toContainText("New session");
  }
  async shouldFindWorktreeSessionByTitle(title: string, repositoryName: string, branch: string): Promise<void> {
    await this.input().fill(`@${title}`);
    await this.shouldShowWorktreeSession(repositoryName, branch);
  }
  async shouldShowSessionOnce(title: string): Promise<void> { await expect(this.session(title)).toHaveCount(1); }
  async shouldNotShowSession(title: string): Promise<void> { await expect(this.session(title)).toHaveCount(0); }
  async selectSession(title: string): Promise<void> {
    const release = this.world.reserveSession([]);
    try {
      await this.session(title).click();
      await expect(this.page.getByRole("textbox", { name: "Message Pi" })).toBeEnabled();
    } finally { release(); }
  }

  private async scopes(): Promise<{ folder: string; worktree: string }> {
    await this.page.getByRole("button", { name: "# Folders", exact: true }).click();
    const folder = this.page.getByRole("option").first();
    await expect(folder).toBeVisible();
    const folderName = await folder.getAttribute("aria-label");
    await this.page.getByRole("button", { name: "% Worktrees", exact: true }).click();
    const worktree = this.page.getByRole("option", { name: /Worktree: feature\/palette/ });
    await expect(worktree).toBeVisible();
    return { folder: folderName!, worktree: (await worktree.getAttribute("aria-label"))! };
  }

  async shouldHideFolderAndWorktreePaths(): Promise<void> {
    const { folder, worktree } = await this.scopes();
    expect(folder).not.toMatch(/New session ·/);
    expect(worktree).not.toContain("palette-checkout");
    expect(worktree).toContain("palette-repo");
  }

  async searchByFolderPath(): Promise<void> {
    await this.input().fill("%palette-checkout");
  }

  async shouldFindMatchingFolderWithoutShowingItsPath(): Promise<void> {
    const result = this.page.getByRole("option", { name: /Worktree: feature\/palette/ });
    await expect(result).toBeVisible();
    await expect(result).not.toContainText("palette-checkout");
    await expect(result).not.toHaveAttribute("aria-label", /palette-checkout/);
  }
}
