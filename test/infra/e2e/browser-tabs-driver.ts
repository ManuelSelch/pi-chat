import assert from "node:assert/strict";
import { expect, type Locator, type Page } from "@playwright/test";
import type { AssistantResponse, TestWorld } from "../pi-chat/test-world.js";

const handleBrand = Symbol("PiChatBrowserTab");
export interface BrowserTabHandle { readonly [handleBrand]: true }

export interface CreateBrowserTabOptions {
  responses: readonly AssistantResponse[];
}

export class BrowserTabsDriver {
  private readonly indexes = new WeakMap<BrowserTabHandle, number>();

  constructor(
    private readonly page: Page,
    private readonly world: TestWorld,
  ) {}

  private tabs(): Locator {
    return this.page.locator("button").filter({ has: this.page.locator("[data-status]") });
  }

  private tab(handle: BrowserTabHandle): Locator {
    const index = this.indexes.get(handle);
    assert(index !== undefined, "Tab belongs to another application or is not a valid tab handle");
    return this.tabs().nth(index);
  }

  async Create(options: CreateBrowserTabOptions): Promise<BrowserTabHandle> {
    const index = await this.tabs().count();
    const release = this.world.reserveSession(options.responses);
    try {
      await this.page.getByRole("button", { name: "New session" }).click();
      await expect(this.tabs()).toHaveCount(index + 1);
      const composer = this.page.getByRole("textbox", { name: "Message Pi" });
      await expect(composer).toBeVisible();
      await expect(composer).toBeEnabled();
      await expect(composer).not.toHaveAttribute("aria-busy", "true");
      await expect(this.page.getByText("Opening…", { exact: true })).not.toBeVisible();
      await expect(this.page.getByText("Connecting…", { exact: true })).not.toBeVisible();
      const handle = Object.freeze({ [handleBrand]: true as const });
      this.indexes.set(handle, index);
      return handle;
    } finally {
      release();
    }
  }

  async SwitchTo(handle: BrowserTabHandle): Promise<void> {
    const tab = this.tab(handle);
    await tab.click();
    await expect.poll(async () => tab.evaluate(element => getComputedStyle(element).borderBottomColor))
      .not.toBe("rgba(0, 0, 0, 0)");
  }

  async Close(handle: BrowserTabHandle): Promise<void> {
    const count = await this.tabs().count();
    await this.tab(handle).getByRole("button", { name: /^Close / }).click();
    await expect(this.tabs()).toHaveCount(count - 1);
  }
}
