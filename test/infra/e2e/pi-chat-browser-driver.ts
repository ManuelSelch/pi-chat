import { expect, type Locator, type Page } from "@playwright/test";

/** Visible-browser driver. Playwright types and selectors stay behind this API. */
export class PiChatBrowserDriver {
  private readonly composer: Locator;

  constructor(
    private readonly page: Page,
    private readonly cleanup: () => Promise<void> = async () => {},
  ) {
    this.composer = page.getByRole("textbox", { name: "Message Pi" });
  }

  async WaitUntilReady(): Promise<void> {
    await expect(this.composer).toBeVisible();
    await expect(this.composer).toBeEnabled();
  }

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

  dispose(): Promise<void> {
    return this.cleanup();
  }
}
