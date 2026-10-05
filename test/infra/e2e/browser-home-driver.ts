import { expect, type Page } from "@playwright/test";

export class BrowserHomeDriver {
  constructor(private readonly page: Page) {}

  async ShouldBeVisible(): Promise<void> {
    await expect(this.page.getByRole("button", { name: "New session" })).toBeVisible();
  }

  async NewSession(): Promise<void> {
    await this.page.getByRole("button", { name: "New session" }).click();
  }
}
