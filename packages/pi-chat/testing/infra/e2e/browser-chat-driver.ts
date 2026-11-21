import { expect, type Locator, type Page } from "@playwright/test";

export class BrowserChatDriver {
  constructor(
    private readonly page: Page,
    private readonly composer: Locator,
  ) {}

  async editDraft(text: string): Promise<void> {
    await this.composer.fill(text);
  }

  async shouldHaveDraft(text: string): Promise<void> {
    await expect(this.composer).toHaveValue(text);
  }

  async sendPrompt(text: string): Promise<void> {
    await this.composer.fill(text);
    await this.composer.press("Enter");
  }

  async shouldBeSteering(): Promise<void> {
    await expect(this.composer).toHaveAttribute("placeholder", "Steer Pi…");
  }

  async shouldHaveQueuedSteering(messages: readonly string[]): Promise<void> {
    const panel = this.page.getByRole("region", { name: "Queued steering" });
    await expect(panel.getByRole("listitem")).toHaveText([...messages]);
    // The approved panel has no internal scroll area or keyboard helper text.
    await expect(panel).toHaveCSS("overflow-y", "visible");
    await expect(panel).toHaveCSS("max-height", "none");
    await expect(this.page.getByText(/Enter to steer/)).toHaveCount(0);
    await expect(this.composer).toHaveValue("");
  }

  async shouldShowAssistantReply(text: string): Promise<void> {
    await expect(this.page.getByRole("main").getByText(text, { exact: true })).toBeVisible();
  }

  async shouldShowUserMessage(text: string): Promise<void> {
    await expect(this.page.getByRole("main").getByText(text, { exact: true })).toBeVisible();
  }

  async shouldNotShowMessage(text: string): Promise<void> {
    await expect(this.page.getByRole("main").getByText(text, { exact: true })).not.toBeVisible();
  }

  async shouldShowLatestReplyInViewport(text: string): Promise<void> {
    const reply = this.page.getByRole("main").getByText(text, { exact: true });
    await expect(reply).toBeInViewport({ ratio: 1 });
    // Being in the viewport alone is insufficient: the fixed composer can hide it.
    await expect.poll(async () => {
      const replyBox = await reply.boundingBox();
      const composerBox = await this.page.locator("form").filter({ has: this.composer }).boundingBox();
      return replyBox !== null && composerBox !== null && replyBox.y + replyBox.height <= composerBox.y;
    }).toBe(true);
  }

  async shouldKeepReplyOutsideViewport(text: string): Promise<void> {
    const reply = this.page.getByRole("main").getByText(text, { exact: true });
    await expect(reply).toBeVisible();
    await expect(reply).not.toBeInViewport();
  }

  async scrollUpInTranscript(): Promise<void> {
    const previous = await this.page.evaluate(() => window.scrollY);
    expect(previous).toBeGreaterThan(0);
    const main = await this.page.getByRole("main").boundingBox();
    if (!main) throw new Error("Transcript is not visible");
    await this.page.mouse.move(main.x + main.width / 2, 300);
    await this.page.mouse.wheel(0, -600);
    await expect.poll(() => this.page.evaluate(() => window.scrollY)).toBeLessThan(previous - 100);
  }

  async shouldBeIdle(): Promise<void> {
    await expect(this.page.locator("form").filter({ has: this.composer })).not.toHaveAttribute("aria-busy", "true");
  }
}
