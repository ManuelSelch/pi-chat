import { expect, type Page } from "@playwright/test";

export class BrowserHomeDriver {
  constructor(private readonly page: Page) {}

  async ShouldBeVisible(): Promise<void> {
    await expect(this.page.getByRole("main").getByRole("button", { name: "New session", exact: true })).toBeVisible();
  }

  async NewSession(): Promise<void> {
    await this.page.getByRole("main").getByRole("button", { name: "New session", exact: true }).click();
  }
}
