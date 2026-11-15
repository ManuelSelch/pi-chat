import { expect, type Page } from "@playwright/test";

export class BrowserHomeDriver {
  constructor(private readonly page: Page) {}

  async shouldBeVisible(): Promise<void> {
    await expect(this.page.getByRole("main").getByRole("textbox", { name: "Search sessions and projects" })).toBeVisible();
  }

}
