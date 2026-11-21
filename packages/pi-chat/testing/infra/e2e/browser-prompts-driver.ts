import { expect, type Page } from "@playwright/test";

/** Prompt presentation operations; selectors and native modal timing stay here. */
export class BrowserPromptsDriver {
  constructor(private readonly page: Page) {}
  private dialog(title: string) { return this.page.getByRole("dialog", { name: title, exact: true }); }

  async filterModels(query: string): Promise<void> {
    await this.dialog("Select a model").getByRole("textbox", { name: "Filter options" }).fill(query);
  }
  async toggleModelScope(): Promise<void> {
    await this.dialog("Select a model").getByRole("textbox", { name: "Filter options" }).press("Tab");
  }
  async shouldHaveModelScope(scope: "Scoped" | "All models", query = ""): Promise<void> {
    const dialog = this.dialog("Select a model");
    await expect(dialog.getByRole("radio", { name: scope, exact: true })).toBeChecked();
    await expect(dialog.getByRole("textbox", { name: "Filter options" })).toHaveValue(query);
    await expect(dialog.getByRole("textbox", { name: "Filter options" })).toBeFocused();
  }
  async shouldOfferModels(ids: string[]): Promise<void> {
    await expect(this.dialog("Select a model").getByRole("option")).toHaveText(ids.map(id => new RegExp(`/${id}$`)));
  }
  async chooseFilteredModel(): Promise<void> {
    await this.dialog("Select a model").getByRole("textbox", { name: "Filter options" }).press("Enter");
    await expect(this.dialog("Select a model")).not.toBeVisible();
  }
  async cancelModels(): Promise<void> {
    await this.dialog("Select a model").getByRole("textbox", { name: "Filter options" }).press("Escape");
    await expect(this.dialog("Select a model")).not.toBeVisible();
  }
  async shouldUseModel(id: string): Promise<void> {
    await expect(this.page.getByRole("contentinfo").getByText(new RegExp(`/${id}$`))).toBeVisible();
  }

  async shouldShowRichQuestion(title: string): Promise<void> {
    const dialog = this.dialog(title);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("strong")).toHaveText("Powers");
    await expect(dialog.locator("pre")).toContainText("2 ** 3");
    await expect(dialog.locator(".katex")).toHaveCount(1);
    await expect(dialog.locator("img, script")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Continue to reasoning" })).toBeDisabled();
  }
  async choose(title: string, choice: string): Promise<void> {
    await this.dialog(title).getByRole("radio", { name: choice, exact: true }).click();
    await expect(this.dialog(title)).toBeVisible();
  }
  async shouldHaveChoice(title: string, choice: string): Promise<void> {
    await expect(this.dialog(title).getByRole("radio", { name: choice, exact: true })).toBeChecked();
  }
  async continue(title: string): Promise<void> {
    await this.dialog(title).getByRole("button", { name: "Continue to reasoning" }).click();
  }
  async minimize(title: string): Promise<void> {
    await this.dialog(title).getByRole("button", { name: "Minimize", exact: true }).click();
    await expect(this.page.getByRole("dialog")).toHaveCount(0);
    await expect(this.page.getByRole("region", { name: "Pending question" })).toBeVisible();
    await expect(this.page.getByRole("textbox", { name: "Message Pi" })).toBeDisabled();
    await expect(this.page.getByRole("button", { name: "Reopen", exact: true })).toBeFocused();
  }
  async stop(): Promise<void> {
    await this.page.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(this.page.getByRole("region", { name: "Pending question" })).not.toBeVisible();
    await expect(this.page.getByRole("dialog")).toHaveCount(0);
  }
  async reopen(title: string): Promise<void> {
    await this.page.getByRole("button", { name: "Reopen", exact: true }).click();
    await expect(this.dialog(title)).toBeVisible();
  }
  async explain(title: string, reasoning: string): Promise<void> {
    await this.dialog(title).getByRole("textbox").fill(reasoning);
  }
  async shouldHaveReasoning(title: string, reasoning: string): Promise<void> {
    await expect(this.dialog(title).getByRole("textbox")).toHaveValue(reasoning);
    await expect(this.dialog(title).getByRole("textbox")).toBeFocused();
  }
  async submitReasoning(title: string): Promise<void> {
    await this.dialog(title).getByRole("button", { name: "Submit answer" }).click();
  }
  async readFeedback(check: number): Promise<void> {
    const feedback = this.page.getByText(`Feedback ${check}: vary the next example and explain why.`, { exact: true });
    await feedback.scrollIntoViewIfNeeded();
    await expect(feedback).toBeVisible();
    await this.page.keyboard.press("Escape");
    await expect(this.page.getByRole("region", { name: "Pending question" })).toBeVisible();
  }
  async shouldFitViewport(): Promise<void> {
    expect(await this.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  async shouldShowLiteralMenu(): Promise<void> {
    const dialog = this.dialog("**Literal menu**");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("strong")).toHaveCount(0);
    await dialog.getByRole("option", { name: "Second" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(this.page.getByText("Literal selection: Second", { exact: true })).toBeVisible();
  }
}
