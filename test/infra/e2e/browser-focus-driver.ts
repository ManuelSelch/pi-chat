import { expect, type Locator, type Page } from "@playwright/test";
import type { TestWorld } from "../pi-chat/test-world.js";

/** Focus assertions never repair focus with click(), fill(), or focus(). */
export class BrowserFocusDriver {
  constructor(private readonly page: Page, private readonly composer: Locator, private readonly world: TestWorld) {}

  async shouldBeOnComposer(): Promise<void> {
    await expect(this.composer).toBeEnabled();
    await expect(this.composer).toBeFocused();
  }

  async typeWithoutRefocusing(text: string): Promise<void> {
    await this.shouldBeOnComposer();
    await this.page.keyboard.type(text);
  }

  async submitDraft(): Promise<void> {
    await this.shouldBeOnComposer();
    await this.composer.press("Enter");
  }

  async shouldHaveDraft(text: string): Promise<void> { await expect(this.composer).toHaveValue(text); }

  async shouldBeLoading(): Promise<void> {
    await expect(this.composer).toBeDisabled();
    await expect(this.composer).toHaveAttribute("placeholder", "Loading session…");
    await expect(this.composer).not.toBeFocused();
  }

  async tryTypingWhileLoading(text: string): Promise<void> {
    await this.shouldBeLoading();
    await this.page.keyboard.type(text);
    await this.shouldHaveDraft("");
  }

  async shouldBeInsideDialog(name: string): Promise<void> {
    const dialog = this.page.getByRole("dialog", { name, exact: true });
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await expect(this.composer).not.toBeFocused();
  }

  async openSettingsFromHeader(): Promise<void> {
    await this.page.getByRole("button", { name: "Settings", exact: true }).click();
    await this.shouldBeInsideDialog("Settings");
  }

  async openFolderFromProjects(): Promise<void> {
    const panel = this.page.getByRole("dialog", { name: "Projects", exact: true }).or(this.page.getByRole("navigation", { name: "Projects", exact: true }));
    await panel.getByRole("button", { name: "Open folder", exact: true }).click();
    await expect(panel).toHaveCount(0);
    await this.shouldBeInsideDialog("Open server folder");
  }

  async openQuickOpen(): Promise<void> {
    await this.page.keyboard.press("ControlOrMeta+o");
    await expect(this.page.getByRole("textbox", { name: "Search folders, worktrees, sessions and actions" })).toBeFocused();
  }

  async dismissQuickOpen(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.page.getByRole("textbox", { name: "Search folders, worktrees, sessions and actions" })).toHaveCount(0);
  }

  async dismissDialog(name: string, via: "Escape" | "Cancel" | "Keep open" = "Escape"): Promise<void> {
    const dialog = this.page.getByRole("dialog", { name, exact: true });
    if (via === "Escape") await this.page.keyboard.press("Escape");
    else await dialog.getByRole("button", { name: via, exact: true }).click();
    // Detachment, not merely a hidden animation frame, marks the exit boundary.
    await expect(dialog).toHaveCount(0);
  }

  async openNestedRestartConfirmation(): Promise<void> {
    await this.page.getByRole("dialog", { name: "Settings", exact: true }).getByRole("button", { name: "Restart", exact: true }).click();
    await this.shouldBeInsideDialog("Restart server?");
  }

  async answerPrompt(title: string, value: string): Promise<void> {
    const dialog = this.page.getByRole("dialog", { name: title, exact: true });
    await dialog.getByRole("textbox").fill(value);
    await dialog.getByRole("button", { name: "OK", exact: true }).click();
  }

  async waitForPromptToClose(title: string): Promise<void> {
    await expect(this.page.getByRole("dialog", { name: title, exact: true })).toHaveCount(0);
  }

  async acceptCloseRunningSession(): Promise<void> {
    const dialog = this.page.getByRole("dialog", { name: "Close running session?", exact: true });
    await dialog.getByRole("button", { name: "Stop and close", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }

  async openFolderAsSession(): Promise<void> {
    const release = this.world.reserveSession([]);
    try {
      await this.page.getByRole("dialog", { name: "Open server folder", exact: true }).getByRole("button", { name: "Open", exact: true }).click();
      await this.waitForPromptToClose("Open server folder");
      await expect(this.composer).toBeEnabled();
    } finally { release(); }
  }

  async shouldAllowTabAwayFromComposer(): Promise<void> {
    await this.shouldBeOnComposer();
    await this.page.keyboard.press("Tab");
    await expect(this.composer).not.toBeFocused();
  }
}
