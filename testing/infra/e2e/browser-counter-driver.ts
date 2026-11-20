import { expect, type Page } from "@playwright/test";

export class BrowserCounterDriver {
  private readonly requests: { method: string }[] = [];
  private connections = 0;

  constructor(private readonly page: Page) {
    page.on("websocket", socket => {
      if (!socket.url().endsWith("/ws")) return;
      ++this.connections;
      socket.on("framesent", ({ payload }) => {
        if (typeof payload === "string") this.requests.push(JSON.parse(payload));
      });
    });
  }

  private panel() { return this.page.getByRole("group", { name: "Counter demo", exact: true }); }

  async open(): Promise<void> {
    await this.page.getByRole("banner").getByRole("button", { name: "Counter", exact: true }).click();
    await expect(this.panel()).toBeVisible();
  }

  async close(): Promise<void> {
    await this.page.getByRole("banner").getByRole("button", { name: "Counter", exact: true }).click();
    await expect(this.panel()).toBeHidden();
  }

  async increment(): Promise<void> {
    await this.panel().getByRole("button", { name: "Increment", exact: true }).click();
  }

  async read(): Promise<void> {
    await this.panel().getByRole("button", { name: "Read current count", exact: true }).click();
  }

  async shouldHaveCount(value: number): Promise<void> {
    await expect(this.panel().getByLabel("Count", { exact: true })).toHaveText(String(value));
    await expect(this.panel().getByRole("button", { name: "Increment", exact: true })).toBeEnabled();
  }

  async shouldBeUnavailable(): Promise<void> {
    await expect(this.panel().getByText("Counter plugin unavailable on this server.", { exact: true })).toBeVisible();
    await expect(this.panel().getByRole("button", { name: "Increment", exact: true })).toBeDisabled();
  }

  async shouldUseOneConnectionWithoutSessions(): Promise<void> {
    expect(this.connections).toBe(1);
    expect(this.requests.some(request => request.method === "plugin.call")).toBe(true);
    expect(this.requests.filter(request => ["session.create", "session.open"].includes(request.method))).toEqual([]);
  }

  async shouldFitViewport(): Promise<void> {
    const panel = await this.panel().boundingBox();
    const viewport = this.page.viewportSize();
    expect(panel).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(viewport!.width);
  }
}
