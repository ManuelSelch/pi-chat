import assert from "node:assert/strict";
import { hyperlink } from "@earendil-works/pi-tui";
import { expect, type Locator, type Page, type Route } from "@playwright/test";
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

  async showHyperlink(label: string, url: string): Promise<void> {
    await this.show(hyperlink(label, url));
  }

  async shouldOpenLinkInNewTab(label: string, url: string): Promise<void> {
    const link = this.content().getByRole("link", { name: label, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", url);
    await expect(link).toHaveAttribute("target", "_blank");
    const context = this.page.context();
    const destination = "Widget link destination";
    const route = async (request: Route) => {
      await request.fulfill({ contentType: "text/html", body: `<h1>${destination}</h1>` });
    };
    await context.route(url, route);
    let popup: Page | undefined;
    try {
      [popup] = await Promise.all([
        this.page.waitForEvent("popup"),
        link.click(),
      ]);
      await expect(popup).toHaveURL(url);
      await expect(popup.getByRole("heading", { name: destination })).toBeVisible();
    } finally {
      await popup?.close();
      await context.unroute(url, route);
    }
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

/** Widgets above the composer share a grid; docked widgets are a single column. */
export class BrowserWidgetsDriver {
  private readonly widgets = new Map<string, BrowserWidgetDriver>();
  constructor(private readonly page: Page, private readonly extensions: ExtensionInputs) {}

  named(key: string): BrowserWidgetDriver {
    let widget = this.widgets.get(key);
    if (!widget) { widget = new BrowserWidgetDriver(this.page, this.extensions, key); this.widgets.set(key, widget); }
    return widget;
  }

  private grid(): Locator { return this.page.locator(".widget-grid-rows"); }

  private card(key: string): Locator {
    return this.page.getByRole("button", { name: new RegExp(`^${key}`) }).locator("..");
  }

  private async box(locator: Locator, what: string): Promise<{ x: number; y: number; width: number; height: number }> {
    const box = await locator.boundingBox();
    assert(box, `${what} is not visible`);
    return box;
  }

  /** Waits until every named card is rendered in the grid, in the given order. */
  async shouldShowCards(keys: readonly string[]): Promise<void> {
    await expect(this.grid().locator("> *")).toHaveCount(keys.length);
    for (const key of keys) await expect(this.card(key)).toBeVisible();
  }

  /** Cards in one grid row share a bottom edge, so the row is identified by it. */
  async shouldPackAtMostTwoPerRow(): Promise<void> {
    const cards = this.grid().locator("> *");
    const count = await cards.count();
    assert(count > 0, "The above-composer widget grid holds no cards");
    const rows = new Map<number, number>();
    for (let index = 0; index < count; index += 1) {
      const box = await this.box(cards.nth(index), `Widget card ${index}`);
      const bottom = Math.round(box.y + box.height);
      rows.set(bottom, (rows.get(bottom) ?? 0) + 1);
    }
    expect(Math.max(...rows.values())).toBeLessThanOrEqual(2);
  }

  async shouldAlignCardBottoms(keys: readonly [string, string]): Promise<void> {
    const left = await this.box(this.card(keys[0]), `Widget card ${keys[0]}`);
    const right = await this.box(this.card(keys[1]), `Widget card ${keys[1]}`);
    expect(Math.abs(left.y + left.height - (right.y + right.height))).toBeLessThanOrEqual(1);
    expect(right.x).toBeGreaterThanOrEqual(left.x + left.width - 1);
  }

  async shouldBeginBelow(key: string, above: string): Promise<void> {
    const card = await this.box(this.card(key), `Widget card ${key}`);
    const previous = await this.box(this.card(above), `Widget card ${above}`);
    expect(card.y).toBeGreaterThanOrEqual(previous.y + previous.height - 1);
  }

  async shouldSpanFullRow(key: string): Promise<void> {
    const card = await this.box(this.card(key), `Widget card ${key}`);
    const grid = await this.box(this.grid(), "The above-composer widget grid");
    expect(Math.abs(card.width - grid.width)).toBeLessThanOrEqual(1);
  }

  async useLayout(layout: "docked" | "composer"): Promise<void> {
    await this.page.setViewportSize({ width: layout === "docked" ? 1600 : 720, height: 900 });
  }

  async shouldUseLayout(layout: "docked" | "composer"): Promise<void> {
    await expect(this.page.getByLabel("Extension panels", { exact: true })).toHaveCount(layout === "docked" ? 1 : 0);
  }
}
