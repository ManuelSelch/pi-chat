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

  async ShouldBeSteering(): Promise<void> {
    await expect(this.composer).toHaveAttribute("placeholder", "Steer Pi…");
  }

  async ShouldHaveQueuedSteering(messages: readonly string[]): Promise<void> {
    const panel = this.page.getByRole("region", { name: "Queued steering" });
    await expect(panel.getByRole("listitem")).toHaveText([...messages]);
    // The approved panel has no internal scroll area or keyboard helper text.
    await expect(panel).toHaveCSS("overflow-y", "visible");
    await expect(panel).toHaveCSS("max-height", "none");
    await expect(this.page.getByText(/Enter to steer/)).toHaveCount(0);
    await expect(this.composer).toHaveValue("");
  }

  async ShouldShowAssistantReply(text: string): Promise<void> {
    await expect(this.page.getByRole("main").getByText(text, { exact: true })).toBeVisible();
  }

  async ShouldShowUserMessage(text: string): Promise<void> {
    await expect(this.page.getByRole("main").getByText(text, { exact: true })).toBeVisible();
  }

  async ShouldNotShowMessage(text: string): Promise<void> {
    await expect(this.page.getByRole("main").getByText(text, { exact: true })).not.toBeVisible();
  }

  async ShouldBeIdle(): Promise<void> {
    await expect(this.page.locator("form").filter({ has: this.composer })).not.toHaveAttribute("aria-busy", "true");
  }
}
