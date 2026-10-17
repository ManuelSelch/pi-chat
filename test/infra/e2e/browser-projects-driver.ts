import { expect, type Locator, type Page } from "@playwright/test";

/** Assertions use the rendered panel; no catalogue or socket state is mocked. */
export class BrowserProjectsDriver {
  private readonly panel: Locator;

  constructor(private readonly page: Page) {
    this.panel = page.getByRole("dialog", { name: "Projects", exact: true });
  }

  async Open(): Promise<void> {
    await this.page.getByRole("button", { name: "Projects and sessions", exact: true }).click();
    await expect(this.panel).toBeVisible();
  }

  async Close(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.panel).not.toBeVisible();
  }

  async Pin(): Promise<void> {
    await this.panel.getByRole("button", { name: /^Pin / }).click();
  }

  async Unpin(): Promise<void> {
    await this.panel.getByRole("button", { name: /^Unpin / }).click();
  }

  async ShouldBePinned(): Promise<void> {
    await expect(this.panel.getByRole("button", { name: /^Unpin / })).toBeEnabled();
    await expect(this.panel.getByRole("button", { name: /^Pin / })).toHaveCount(0);
  }

  async ShouldBeUnpinned(): Promise<void> {
    await expect(this.panel.getByRole("button", { name: /^Pin / })).toBeEnabled();
    await expect(this.panel.getByRole("button", { name: /^Unpin / })).toHaveCount(0);
  }

  async Archive(title: string): Promise<void> {
    await this.panel.getByRole("button", { name: title, exact: true }).hover();
    await this.panel.getByRole("button", { name: `Archive ${title}`, exact: true }).click();
  }

  async ShouldShowActiveSession(title: string): Promise<void> {
    await expect(this.panel.getByRole("button", { name: title, exact: true })).toBeVisible();
    await expect(this.panel.getByRole("button", { name: `Archive ${title}`, exact: true })).toBeEnabled();
    await expect(this.panel.getByRole("button", { name: `Restore ${title}`, exact: true })).toHaveCount(0);
  }

  async ShouldNotShowSession(title: string): Promise<void> {
    await expect(this.panel.getByRole("button", { name: title, exact: true })).toHaveCount(0);
    await expect(this.panel.getByRole("button", { name: `Archive ${title}`, exact: true })).toHaveCount(0);
  }

  async ShouldHideArchivedSection(): Promise<void> {
    await expect(this.panel.getByRole("button", { name: /^Archived/ })).toHaveCount(0);
  }

  async ShowArchivedSessions(): Promise<void> {
    const toggle = this.panel.getByRole("button", { name: /^Archived/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }

  async ShouldShowArchivedSession(title: string): Promise<void> {
    await expect(this.panel.getByRole("button", { name: title, exact: true })).toBeVisible();
    await expect(this.panel.getByRole("button", { name: `Restore ${title}`, exact: true })).toBeEnabled();
    await expect(this.panel.getByRole("button", { name: `Archive ${title}`, exact: true })).toHaveCount(0);
  }
}
