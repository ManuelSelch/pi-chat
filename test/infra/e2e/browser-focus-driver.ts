import { expect, type Locator, type Page } from "@playwright/test";
import type { TestWorld } from "../pi-chat/test-world.js";

/** Focus assertions never repair focus with click(), fill(), or focus(). */
export class BrowserFocusDriver {
  constructor(private readonly page: Page, private readonly composer: Locator, private readonly world: TestWorld) {}

  async ShouldBeOnComposer(): Promise<void> {
    await expect(this.composer).toBeEnabled();
    await expect(this.composer).toBeFocused();
  }

  async TypeWithoutRefocusing(text: string): Promise<void> {
    await this.ShouldBeOnComposer();
    await this.page.keyboard.type(text);
  }

  async ShouldHaveDraft(text: string): Promise<void> { await expect(this.composer).toHaveValue(text); }

  async ShouldBeLoading(): Promise<void> {
    await expect(this.composer).toBeDisabled();
    await expect(this.composer).toHaveAttribute("placeholder", "Loading session…");
    await expect(this.composer).not.toBeFocused();
  }

  async TryTypingWhileLoading(text: string): Promise<void> {
    await this.ShouldBeLoading();
    await this.page.keyboard.type(text);
    await this.ShouldHaveDraft("");
  }

  async ShouldBeInsideDialog(name: string): Promise<void> {
    const dialog = this.page.getByRole("dialog", { name, exact: true });
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await expect(this.composer).not.toBeFocused();
  }

  async OpenSettingsFromHeader(): Promise<void> {
    await this.page.getByRole("button", { name: "Settings", exact: true }).click();
    await this.ShouldBeInsideDialog("Settings");
  }

  async OpenFolderFromProjects(): Promise<void> {
    await this.page.getByRole("dialog", { name: "Projects", exact: true }).getByRole("button", { name: "Open folder", exact: true }).click();
    await this.page.getByRole("dialog", { name: "Projects", exact: true }).waitFor({ state: "detached" });
    await this.ShouldBeInsideDialog("Open server folder");
  }

  async OpenQuickOpen(): Promise<void> {
    await this.page.keyboard.press("ControlOrMeta+o");
    await expect(this.page.getByRole("textbox", { name: "Search folders, worktrees, sessions and actions" })).toBeFocused();
  }

  async DismissQuickOpen(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.page.getByRole("textbox", { name: "Search folders, worktrees, sessions and actions" })).toHaveCount(0);
  }

  async DismissDialog(name: string, via: "Escape" | "Cancel" | "Keep open" = "Escape"): Promise<void> {
    const dialog = this.page.getByRole("dialog", { name, exact: true });
    if (via === "Escape") await this.page.keyboard.press("Escape");
    else await dialog.getByRole("button", { name: via, exact: true }).click();
    // Detachment, not merely a hidden animation frame, marks the exit boundary.
    await expect(dialog).toHaveCount(0);
  }

  async OpenNestedRestartConfirmation(): Promise<void> {
    await this.page.getByRole("dialog", { name: "Settings", exact: true }).getByRole("button", { name: "Restart", exact: true }).click();
    await this.ShouldBeInsideDialog("Restart server?");
  }

  async AnswerPrompt(title: string, value: string): Promise<void> {
    const dialog = this.page.getByRole("dialog", { name: title, exact: true });
    await dialog.getByRole("textbox").fill(value);
    await dialog.getByRole("button", { name: "OK", exact: true }).click();
  }

  async WaitForPromptToClose(title: string): Promise<void> {
    await expect(this.page.getByRole("dialog", { name: title, exact: true })).toHaveCount(0);
  }

  async AcceptCloseRunningSession(): Promise<void> {
    const dialog = this.page.getByRole("dialog", { name: "Close running session?", exact: true });
    await dialog.getByRole("button", { name: "Stop and close", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }

  async OpenFolderAsSession(): Promise<void> {
    const release = this.world.reserveSession([]);
    try {
      await this.page.getByRole("dialog", { name: "Open server folder", exact: true }).getByRole("button", { name: "Open", exact: true }).click();
      await this.WaitForPromptToClose("Open server folder");
      await expect(this.composer).toBeEnabled();
    } finally { release(); }
  }

  async ShouldAllowTabAwayFromComposer(): Promise<void> {
    await this.ShouldBeOnComposer();
    await this.page.keyboard.press("Tab");
    await expect(this.composer).not.toBeFocused();
  }
}
