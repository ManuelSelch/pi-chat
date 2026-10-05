import { expect, type Locator, type Page } from "@playwright/test";

export class BrowserChatDriver {
  constructor(
    private readonly page: Page,
    private readonly composer: Locator,
  ) {}

  async SendPrompt(text: string): Promise<void> {
    await this.composer.fill(text);
    await this.composer.press("Enter");
  }

  async ShouldShowAssistantReply(text: string): Promise<void> {
    await expect(this.page.getByText(text, { exact: true })).toBeVisible();
  }

  async ShouldShowUserMessage(text: string): Promise<void> {
    await expect(this.page.getByText(text, { exact: true })).toBeVisible();
  }

  async ShouldBeIdle(): Promise<void> {
    await expect(this.composer).not.toHaveAttribute("aria-busy", "true");
  }
}
