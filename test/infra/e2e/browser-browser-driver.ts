import { expect, type Page } from "@playwright/test";
import { pageCoverage } from "./coverage/browser-coverage.js";

export class BrowserBrowserDriver {
  constructor(private readonly page: Page) {}

  async Reload(): Promise<void> {
    await pageCoverage.get(this.page)?.checkpoint();
    await this.page.reload({ waitUntil: "networkidle" });
    const composer = this.page.getByRole("textbox", { name: "Message Pi" });
    await expect(composer).toBeVisible();
    await expect(composer).toBeEnabled();
    await expect(this.page.getByText("Connecting…", { exact: true })).not.toBeVisible();
  }
}
