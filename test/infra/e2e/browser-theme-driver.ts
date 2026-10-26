import { expect, type Page } from "@playwright/test";
import type { SessionTheme } from "@manuelselch/pi-sdk";

function rgb(hex: string) { return `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`; }

/** Real computed styles and socket lifecycle stay behind the feature DSL. */
export class BrowserThemeDriver {
  constructor(private readonly page: Page) {}
  async shouldUse(palette: SessionTheme): Promise<void> {
    await expect(this.page.locator("html")).toHaveAttribute("data-mantine-color-scheme", palette.appearance);
    await expect(this.page.locator("body")).toHaveCSS("background-color", rgb(palette.surfaces.pageBg));
    await expect(this.page.locator("body")).toHaveCSS("color", rgb(palette.colors.text));
    await expect(this.page.locator("[data-status]").first()).toHaveCSS("background-color", rgb(palette.colors.success));
    await expect(this.page.locator("header")).toHaveCSS("border-bottom-color", rgb(palette.colors.border));
  }
  async shouldThemePortal(palette: SessionTheme): Promise<void> {
    await expect(this.page.getByRole("dialog", { name: "Settings" })).toHaveCSS("background-color", rgb(palette.surfaces.pageBg));
  }
  async shouldUseDefaults(): Promise<void> {
    await expect.poll(() => this.page.locator("html").evaluate(el => getComputedStyle(el).getPropertyValue("--pi-user-bg"))).toBe("");
  }
  async reconnect(): Promise<void> {
    // Interrupt just this page's real socket; the server and SDK reconnect normally.
    const previousCount = await this.page.evaluate(() => {
      const sockets = (window as unknown as { themeTestSockets: WebSocket[] }).themeTestSockets;
      sockets.at(-1)!.close(1000, "isolated theme test");
      return sockets.length;
    });
    await expect.poll(() => this.page.evaluate(() => {
      const sockets = (window as unknown as { themeTestSockets: WebSocket[] }).themeTestSockets;
      return sockets.at(-1)?.readyState === WebSocket.OPEN ? sockets.length : 0;
    })).toBeGreaterThan(previousCount);
    await expect(this.page.getByText("Waiting for the Pi Chat server…", { exact: true })).not.toBeVisible();
    await expect(this.page.getByText("Connecting…", { exact: true })).not.toBeVisible();
    await expect(this.page.getByRole("textbox", { name: "Message Pi" })).toBeEnabled();
  }
  async prepareReconnectProbe(): Promise<void> {
    await this.page.addInitScript(() => {
      const Native = window.WebSocket;
      const sockets: WebSocket[] = [];
      (window as unknown as { themeTestSockets: WebSocket[] }).themeTestSockets = sockets;
      window.WebSocket = class extends Native {
        constructor(url: string | URL, protocols?: string | string[]) { super(url, protocols); sockets.push(this); }
      };
    });
  }
}
