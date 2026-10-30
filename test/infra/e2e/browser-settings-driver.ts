import { expect, type Locator, type Page } from "@playwright/test";
import { pageCoverage } from "./coverage/browser-coverage.js";

export class BrowserSettingsDriver {
  private readonly panel: Locator;
  private readonly socketErrors: string[] = [];

  constructor(private readonly page: Page) {
    page.on("websocket", socket => socket.on("socketerror", error => this.socketErrors.push(error)));
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

  private endpoint(mode: "page" | "unreachable" | "other-host"): string {
    const url = new URL(this.page.url());
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = mode === "unreachable" ? "/not-a-websocket" : "/ws";
    url.search = mode === "page" ? "?endpoint-test=remembered" : "";
    if (mode === "other-host") url.hostname = "localhost";
    return url.href;
  }

  /** Mirrors the app's page-derived default endpoint, which now pre-fills the field. */
  private defaultEndpoint(): string {
    const url = new URL(this.page.url());
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    return url.href;
  }

  async editEndpoint(mode: "page" | "unreachable" | "other-host"): Promise<void> {
    await this.panel.getByRole("textbox", { name: "WebSocket endpoint" }).fill(this.endpoint(mode));
  }

  async requestSaveEndpoint(): Promise<void> {
    await this.panel.getByRole("button", { name: "Save and reload", exact: true }).click();
    await expect(this.page.getByRole("dialog", { name: "Save endpoint and reload?", exact: true })).toBeVisible();
  }

  async cancelEndpointChange(): Promise<void> {
    await this.page.getByRole("dialog", { name: "Save endpoint and reload?", exact: true }).getByRole("button", { name: "Cancel", exact: true }).click();
  }

  async confirmEndpointChange(): Promise<void> {
    const dialog = this.page.getByRole("dialog", { name: /^(Save endpoint|Reset endpoint) and reload\?$/ });
    await expect(dialog).toContainText("unsent drafts");
    await pageCoverage.get(this.page)?.checkpoint();
    await Promise.all([
      this.page.waitForEvent("load"),
      dialog.getByRole("button", { name: /^(Save|Reset) and reload$/ }).click(),
    ]);
    await expect(this.page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  }

  async resetEndpoint(): Promise<void> {
    await this.panel.getByRole("button", { name: "Reset to default", exact: true }).click();
    await this.confirmEndpointChange();
  }

  async shouldUseRememberedEndpoint(): Promise<void> {
    const endpoint = this.endpoint("page");
    await expect(this.panel.getByRole("textbox", { name: "WebSocket endpoint" })).toHaveValue(endpoint);
    await expect.poll(() => this.page.evaluate(() => localStorage.getItem("pi-chat:serverEndpoint"))).toBe(endpoint);
    await expect(this.panel.getByText("Connected", { exact: true })).toBeVisible();
  }

  async shouldKeepUnsavedEndpoint(): Promise<void> {
    await expect(this.panel.getByRole("textbox", { name: "WebSocket endpoint" })).toHaveValue(this.endpoint("page"));
    expect(await this.page.evaluate(() => localStorage.getItem("pi-chat:serverEndpoint"))).toBeNull();
    await expect(this.panel.getByText("Connected", { exact: true })).toBeVisible();
  }

  async shouldRejectOtherHost(): Promise<void> {
    await this.shouldShowEndpointFailure();
    await expect.poll(() => this.socketErrors.some(error => error.includes("403"))).toBe(true);
  }

  async shouldUseDefaultEndpoint(): Promise<void> {
    await expect(this.panel.getByRole("textbox", { name: "WebSocket endpoint" })).toHaveValue(this.defaultEndpoint());
    expect(await this.page.evaluate(() => localStorage.getItem("pi-chat:serverEndpoint"))).toBeNull();
    await expect(this.panel.getByText("Connected", { exact: true })).toBeVisible();
  }

  async shouldShowEndpointFailure(): Promise<void> {
    await expect(this.panel.getByText("Disconnected", { exact: true })).toBeVisible();
    await expect(this.panel.getByText(/Could not connect/)).toBeVisible();
    await expect(this.panel.getByRole("button", { name: "Reset to default", exact: true })).toBeEnabled();
  }

  async denyEndpointStorage(): Promise<void> {
    await this.page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "pi-chat:serverEndpoint") throw new DOMException("Denied", "SecurityError");
        return original.call(this, key, value);
      };
    });
  }

  async confirmFailedEndpointSave(): Promise<void> {
    await this.page.getByRole("dialog", { name: "Save endpoint and reload?", exact: true }).getByRole("button", { name: "Save and reload", exact: true }).click();
    await expect(this.panel.getByText(/Could not save the endpoint/)).toBeVisible();
    await expect(this.panel.getByText("Connected", { exact: true })).toBeVisible();
    expect(await this.page.evaluate(() => localStorage.getItem("pi-chat:serverEndpoint"))).toBeNull();
  }

  async Close(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.panel).not.toBeVisible();
  }
}
