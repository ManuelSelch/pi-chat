import { expect, type Page } from "@playwright/test";

/** Prompt presentation operations; selectors and native modal timing stay here. */
export class BrowserPromptsDriver {
  constructor(private readonly page: Page) {}
  private dialog(title: string) { return this.page.getByRole("dialog", { name: title, exact: true }); }

  async ShouldShowRichQuestion(title: string): Promise<void> {
    const dialog = this.dialog(title);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("strong")).toHaveText("Powers");
    await expect(dialog.locator("pre")).toContainText("2 ** 3");
    await expect(dialog.locator(".katex")).toHaveCount(1);
    await expect(dialog.locator("img, script")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Continue to reasoning" })).toBeDisabled();
  }
  async Choose(title: string, choice: string): Promise<void> {
    await this.dialog(title).getByRole("radio", { name: choice, exact: true }).click();
    await expect(this.dialog(title)).toBeVisible();
  }
  async ShouldHaveChoice(title: string, choice: string): Promise<void> {
    await expect(this.dialog(title).getByRole("radio", { name: choice, exact: true })).toBeChecked();
  }
  async Continue(title: string): Promise<void> {
    await this.dialog(title).getByRole("button", { name: "Continue to reasoning" }).click();
  }
  async Minimize(title: string): Promise<void> {
    await this.dialog(title).getByRole("button", { name: "Minimize", exact: true }).click();
    await expect(this.page.getByRole("dialog")).toHaveCount(0);
    await expect(this.page.getByRole("region", { name: "Pending question" })).toBeVisible();
    await expect(this.page.getByRole("textbox", { name: "Message Pi" })).toBeDisabled();
    await expect(this.page.getByRole("button", { name: "Reopen", exact: true })).toBeFocused();
  }
  async Stop(): Promise<void> {
    await this.page.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(this.page.getByRole("region", { name: "Pending question" })).not.toBeVisible();
    await expect(this.page.getByRole("dialog")).toHaveCount(0);
  }
  async Reopen(title: string): Promise<void> {
    await this.page.getByRole("button", { name: "Reopen", exact: true }).click();
    await expect(this.dialog(title)).toBeVisible();
  }
  async Explain(title: string, reasoning: string): Promise<void> {
    await this.dialog(title).getByRole("textbox").fill(reasoning);
  }
  async ShouldHaveReasoning(title: string, reasoning: string): Promise<void> {
    await expect(this.dialog(title).getByRole("textbox")).toHaveValue(reasoning);
    await expect(this.dialog(title).getByRole("textbox")).toBeFocused();
  }
  async SubmitReasoning(title: string): Promise<void> {
    await this.dialog(title).getByRole("button", { name: "Submit answer" }).click();
  }
  async ReadFeedback(check: number): Promise<void> {
    const feedback = this.page.getByText(`Feedback ${check}: vary the next example and explain why.`, { exact: true });
    await feedback.scrollIntoViewIfNeeded();
    await expect(feedback).toBeVisible();
    await this.page.keyboard.press("Escape");
    await expect(this.page.getByRole("region", { name: "Pending question" })).toBeVisible();
  }
  async ShouldFitViewport(): Promise<void> {
    expect(await this.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  async ShouldShowLiteralMenu(): Promise<void> {
    const dialog = this.dialog("**Literal menu**");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("strong")).toHaveCount(0);
    await dialog.getByRole("option", { name: "Second" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(this.page.getByText("Literal selection: Second", { exact: true })).toBeVisible();
  }
}
