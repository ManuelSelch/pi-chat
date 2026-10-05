import { expect, type Page } from "@playwright/test";

export class BrowserBrowserDriver {
  constructor(private readonly page: Page) {}

  async Reload(): Promise<void> {
    await this.page.reload({ waitUntil: "networkidle" });
    const composer = this.page.getByRole("textbox", { name: "Message Pi" });
    await expect(composer).toBeVisible();
    await expect(composer).toBeEnabled();
    await expect(this.page.getByText("Connecting…", { exact: true })).not.toBeVisible();
  }
}
