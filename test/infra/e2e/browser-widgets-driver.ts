import { expect, type Locator, type Page } from "@playwright/test";

/** Only visible UI actions/assertions; the fixture extension runs on the real Pi host. */
export class BrowserWidgetsDriver {
  constructor(private readonly page: Page, private readonly composer: Locator) {}

  private content(): Locator { return this.page.getByRole("region", { name: "status widget", exact: true }); }

  async useLayout(layout: "docked" | "composer"): Promise<void> {
    await this.page.setViewportSize({ width: layout === "docked" ? 1600 : 720, height: 900 });
  }

  private async command(name: string): Promise<void> {
    await expect(this.composer).toBeEnabled();
    await this.composer.fill(`/${name}`);
    await this.composer.press("Escape");
    await this.composer.press("Enter");
    await expect(this.composer).toHaveValue("");
  }

  async show(): Promise<void> { await this.command("widget-show"); }
  async changeColor(): Promise<void> { await this.command("widget-error"); }
  async clear(): Promise<void> { await this.command("widget-clear"); }

  async shouldShowStyledWidget(color: "success" | "error", layout: "docked" | "composer"): Promise<void> {
    const content = this.content();
    await expect(content).toBeVisible();
    const status = content.getByText("Status", { exact: true });
    await expect(status).toHaveCSS("color", color === "success" ? "rgb(104, 183, 141)" : "rgb(234, 127, 129)");
    await expect(status).toHaveCSS("font-weight", "600");
    await expect(status).toHaveCSS("font-style", "italic");
    await expect(status).toHaveCSS("text-decoration-line", "underline line-through");
    const multiline = content.getByText(/first/);
    await expect(multiline).toHaveCSS("color", "rgb(12, 34, 56)");
    expect(await multiline.textContent()).toBe("first\n  second 😀");
    expect(await content.textContent()).toBe('Status\nfirst\n  second 😀\n\n[Frontend](https://example.com)\n<img src=x onerror="alert(1)">\n' + "longword".repeat(30));
    await expect(content).toHaveCSS("white-space", "pre-wrap");
    await expect(content).toHaveCSS("overflow-wrap", "anywhere");
    expect(await content.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(content.locator("a, img, script")).toHaveCount(0);
    await expect(this.page.getByLabel("Extension panels", { exact: true })).toHaveCount(layout === "docked" ? 1 : 0);
  }

  async shouldHaveNoWidgets(): Promise<void> { await expect(this.content()).toHaveCount(0); }
}
