import type { Widget, WidgetPlacement } from "../shared/protocol.js";

/**
 * Terminal widgets may carry colour, and the browser renders them as text, so
 * the escape sequences would otherwise show up as literal garbage.
 */
const ANSI = new RegExp("\\u001B\\[[0-9;?]*[ -/]*[@-~]", "g");

export function stripAnsi(line: string): string {
  return line.replace(ANSI, "");
}

/**
 * A widget's trailing blank lines are terminal spacing, which a browser panel
 * provides with padding. Dropping them also makes "nothing but spacers" the
 * same as "no widget", which is what the web UI should show for it.
 */
function normalize(lines: string[]): string[] {
  const cleaned = lines.map(stripAnsi);
  let end = cleaned.length;
  while (end > 0 && cleaned[end - 1]!.trim() === "") end--;
  return cleaned.slice(0, end);
}

function sameLines(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((line, index) => line === right[index]);
}

/**
 * Holds the `ctx.ui.setWidget` panels of one session.
 *
 * Widgets are keyed and long-lived: an extension re-sends the whole block on
 * every change and clears it by passing `undefined`. Pi's RPC protocol defines
 * them as plain string lines, which is exactly what a web client can render, so
 * no per-extension support is needed here.
 */
export class WidgetRegistry {
  private readonly widgets = new Map<string, Widget>();

  constructor(private readonly onChange: (widgets: Widget[]) => void) {}

  /**
   * `undefined` clears, per Pi's contract. Unchanged content is dropped without
   * an event: a widget backed by a component re-renders far more often than it
   * actually changes, and every repaint would otherwise reach the browser.
   */
  set(key: string, lines: string[] | undefined, placement: WidgetPlacement = "aboveEditor"): void {
    const existing = this.widgets.get(key);
    const next = lines === undefined ? undefined : normalize(lines);

    if (next === undefined || next.length === 0) {
      if (!this.widgets.delete(key)) return;
      this.onChange(this.list());
      return;
    }

    if (existing && existing.placement === placement && sameLines(existing.lines, next)) return;
    this.widgets.set(key, { key, lines: next, placement });
    this.onChange(this.list());
  }

  /** Insertion-ordered, so a session's panels keep a stable position. */
  list(): Widget[] {
    return [...this.widgets.values()];
  }

  /** A disposed session's panels must not outlive it on screen. */
  clear(): void {
    if (this.widgets.size === 0) return;
    this.widgets.clear();
    this.onChange(this.list());
  }
}
