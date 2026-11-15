import { expect, type Page } from "@playwright/test";

/** Real computed styles and socket lifecycle stay behind the feature DSL. */
export class BrowserThemeDriver {
  constructor(private readonly page: Page) {}
  async shouldUseAppTheme(): Promise<void> {
    await this.shouldUseAppThemeShell();
    await expect(this.page.locator("[data-status]").first()).toHaveCSS("background-color", "rgb(123, 189, 164)");
  }
  async shouldUseAppThemeShell(): Promise<void> {
    await expect(this.page.locator("html")).toHaveAttribute("data-mantine-color-scheme", "dark");
    await expect(this.page.locator("body")).toHaveCSS("background-color", "rgb(24, 25, 30)");
    await expect(this.page.locator("body")).toHaveCSS("color", "rgb(229, 229, 237)");
    await expect(this.page.locator("header")).toHaveCSS("border-bottom-color", "rgb(48, 49, 59)");
    await expect.poll(() => this.page.locator("html").evaluate(el => getComputedStyle(el).getPropertyValue("--mantine-color-blue-filled").trim())).toBe("#b39af6");
  }
  async shouldThemePortalAppTheme(): Promise<void> {
    await expect(this.page.getByRole("dialog", { name: "Settings" })).toHaveCSS("background-color", "rgb(24, 25, 30)");
  }
  async rememberLegacyLightAppearance(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.setItem("pi-chat:lastTheme", JSON.stringify({ name: "old-light", appearance: "light", colors: {
        accent: "#23614c", text: "#182d25", muted: "#666666", border: "#888888", selectedBg: "#eeeeee", mdLink: "#23614c",
        success: "#28734c", warning: "#aa9900", error: "#aa0000", userMessageBg: "#ffffff", userMessageText: "#182d25",
        thinkingText: "#666666", toolDiffAdded: "#28734c", toolDiffRemoved: "#aa0000",
      }, surfaces: { pageBg: "#f6f3e8", cardBg: "#fffdf4", infoBg: "#e6eee4" } }));
      localStorage.setItem("mantine-color-scheme-value", "light");
    });
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
