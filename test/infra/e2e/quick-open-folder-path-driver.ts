import { expect, type Page } from "@playwright/test";

export class QuickOpenFolderPathDriver {
  constructor(private readonly page: Page) {}

  async close(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.page.getByRole("textbox", { name: "Search folders, worktrees, sessions and actions" })).not.toBeVisible();
  }

  async open(): Promise<void> {
    await this.page.keyboard.press("Meta+o");
    await expect(this.page.getByRole("textbox", { name: "Search folders, worktrees, sessions and actions" })).toBeVisible();
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

  async shouldShowFolderAndWorktreePaths(): Promise<void> {
    const { folder, worktree } = await this.scopes();
    expect(folder).toMatch(/New session ·/);
    expect(worktree).toContain("palette-checkout");
  }

  async searchByFolderPath(): Promise<void> {
    await this.page.getByRole("textbox", { name: "Search folders, worktrees, sessions and actions" }).fill("%palette-checkout");
  }

  async shouldFindMatchingFolderWithoutShowingItsPath(): Promise<void> {
    const result = this.page.getByRole("option", { name: /Worktree: feature\/palette/ });
    await expect(result).toBeVisible();
    await expect(result).not.toContainText("palette-checkout");
    await expect(result).not.toHaveAttribute("aria-label", /palette-checkout/);
  }
}
