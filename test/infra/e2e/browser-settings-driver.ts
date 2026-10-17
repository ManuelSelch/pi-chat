import { expect, type Locator, type Page } from "@playwright/test";

export class BrowserSettingsDriver {
  private readonly panel: Locator;

  constructor(private readonly page: Page) {
    this.panel = page.getByRole("dialog", { name: "Settings", exact: true });
  }

  async Open(): Promise<void> {
    await this.page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(this.panel).toBeVisible();
  }

  async SetHideArchivedSessions(hide: boolean): Promise<void> {
    await this.panel.getByRole("switch", { name: "Hide archived sessions", exact: true }).setChecked(hide);
  }

  async ShouldHideArchivedSessions(hide: boolean): Promise<void> {
    await expect(this.panel.getByRole("switch", { name: "Hide archived sessions", exact: true })).toBeChecked({ checked: hide });
  }

  async Close(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.panel).not.toBeVisible();
  }
}
