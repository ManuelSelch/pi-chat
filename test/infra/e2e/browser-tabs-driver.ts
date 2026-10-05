import { expect, type Page } from "@playwright/test";
import type { AssistantResponse, TestWorld } from "../pi-chat/test-world.js";

export interface CreateBrowserTabOptions {
  responses: readonly AssistantResponse[];
}

export class BrowserTabsDriver {
  constructor(
    private readonly page: Page,
    private readonly world: TestWorld,
  ) {}

  async Create(options: CreateBrowserTabOptions): Promise<void> {
    const release = this.world.reserveSession(options.responses);
    try {
      await this.page.getByRole("button", { name: "New session" }).click();
      const composer = this.page.getByRole("textbox", { name: "Message Pi" });
      await expect(composer).toBeVisible();
      await expect(composer).toBeEnabled();
      await expect(composer).not.toHaveAttribute("aria-busy", "true");
      await expect(this.page.getByText("Opening…", { exact: true })).not.toBeVisible();
      await expect(this.page.getByText("Connecting…", { exact: true })).not.toBeVisible();
    } finally {
      release();
    }
  }
}
