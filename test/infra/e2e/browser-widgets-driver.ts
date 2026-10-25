import assert from "node:assert/strict";
import { expect, type Locator, type Page } from "@playwright/test";
import type { BrowserExtensionsDriver } from "./browser-extensions-driver.js";

type WidgetColor = "success" | "error" | readonly [number, number, number];
type TextStyle = "bold" | "italic" | "underline" | "strikethrough";
export interface WidgetStyle { color?: WidgetColor; styles?: readonly TextStyle[] }
type ExtensionInputs = Pick<BrowserExtensionsDriver, "setWidget" | "clearWidget">;

function cssColor(color: WidgetColor): string {
  if (typeof color !== "string") return `rgb(${color.join(", ")})`;
  return color === "success" ? "rgb(104, 183, 141)" : "rgb(234, 127, 129)";
}

/** One named widget's explicit inputs and browser assertions. */
export class BrowserWidgetDriver {
  private current?: { text: string; style: WidgetStyle };

  constructor(private readonly page: Page, private readonly extensions: ExtensionInputs, private readonly key: string) {}

  private content(): Locator { return this.page.getByRole("region", { name: `${this.key} widget`, exact: true }); }
  private text(): Locator { return this.content().locator("span").last(); }

  async show(text: string, style: WidgetStyle = {}): Promise<void> {
    const styles = [...(style.styles ?? [])];
    const copy: WidgetStyle = {
      color: typeof style.color === "object" ? [...style.color] as [number, number, number] : style.color,
      styles,
    };
    await this.extensions.setWidget(this.key, {
      text, foreground: copy.color,
      bold: styles.includes("bold"), italic: styles.includes("italic"),
      underline: styles.includes("underline"), strikethrough: styles.includes("strikethrough"),
    });
    this.current = { text, style: copy };
  }

  /** Omitted fields are retained; styles replaces the list; undefined color resets it. */
  async updateStyle(style: WidgetStyle): Promise<void> {
    assert(this.current, `Show widget ${this.key} before updating its style`);
    await this.show(this.current.text, { ...this.current.style, ...style });
  }

  async clear(): Promise<void> {
    await this.extensions.clearWidget(this.key);
    this.current = undefined;
  }

  async shouldHaveColor(color: WidgetColor): Promise<void> {
    await expect(this.content()).toBeVisible();
    await expect(this.text()).toHaveCSS("color", cssColor(color));
  }

  async shouldHaveStyles(styles: readonly TextStyle[]): Promise<void> {
    await expect(this.content()).toBeVisible();
    await expect(this.text()).toHaveCSS("font-weight", styles.includes("bold") ? "600" : "400");
    await expect(this.text()).toHaveCSS("font-style", styles.includes("italic") ? "italic" : "normal");
    const decoration = [styles.includes("underline") && "underline", styles.includes("strikethrough") && "line-through"].filter(Boolean).join(" ");
    await expect(this.text()).toHaveCSS("text-decoration-line", decoration || "none");
  }

  async shouldHaveText(text: string): Promise<void> {
    await expect(this.content()).toBeVisible();
    await expect.poll(() => this.content().textContent()).toBe(text);
  }

  async shouldWrapText(): Promise<void> {
    const content = this.content();
    await expect(content).toHaveCSS("white-space", "pre-wrap");
    await expect(content).toHaveCSS("overflow-wrap", "anywhere");
    await expect.poll(() => content.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }

  async shouldContainNoMarkupOrLinks(): Promise<void> {
    await expect(this.content()).toBeVisible();
    await expect(this.content().locator("a, img, script")).toHaveCount(0);
  }
  async shouldBeAbsent(): Promise<void> { await expect(this.content()).toHaveCount(0); }
}

/** Names own stable handles; low-level extension inputs remain available separately. */
export class BrowserWidgetsDriver {
  private readonly widgets = new Map<string, BrowserWidgetDriver>();
  constructor(private readonly page: Page, private readonly extensions: ExtensionInputs) {}

  named(key: string): BrowserWidgetDriver {
    let widget = this.widgets.get(key);
    if (!widget) { widget = new BrowserWidgetDriver(this.page, this.extensions, key); this.widgets.set(key, widget); }
    return widget;
  }

  async useLayout(layout: "docked" | "composer"): Promise<void> {
    await this.page.setViewportSize({ width: layout === "docked" ? 1600 : 720, height: 900 });
  }

  async shouldUseLayout(layout: "docked" | "composer"): Promise<void> {
    await expect(this.page.getByLabel("Extension panels", { exact: true })).toHaveCount(layout === "docked" ? 1 : 0);
  }
}
