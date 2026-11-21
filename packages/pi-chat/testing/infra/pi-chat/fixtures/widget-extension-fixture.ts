import assert from "node:assert/strict";
import type { ExtensionContext, ExtensionFactory, ThemeColor } from "@earendil-works/pi-coding-agent";
import { rgbColor } from "@earendil-works/pi-tui";

export interface WidgetText {
  text: string;
  foreground?: ThemeColor | readonly [number, number, number];
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

/** Test-owned input boundary. Calls real ctx.ui methods, never fabricates wire events. */
export class WidgetExtensionFixture {
  private readonly contexts = new Set<() => ExtensionContext | undefined>();

  readonly extension: ExtensionFactory = pi => {
    let context: ExtensionContext | undefined;
    const current = () => context;
    pi.on("session_start", (_event, ctx) => { context = ctx; this.contexts.add(current); });
    pi.on("session_shutdown", () => { this.contexts.delete(current); context = undefined; });
  };

  private context(): ExtensionContext {
    assert.equal(this.contexts.size, 1, "Widget fixture requires exactly one live test session");
    const context = [...this.contexts][0]!();
    assert(context, "Widget fixture has not started");
    // ctx.ui is a live getter: retaining the context does not freeze the harness UI.
    return context;
  }

  setWidget(key: string, content: WidgetText | readonly WidgetText[]): void {
    const { ui } = this.context();
    const lines: readonly WidgetText[] = Array.isArray(content) ? content : [content as WidgetText];
    ui.setWidget(key, lines.map(({ text, foreground, ...decorations }) => ui.theme.style(text, {
      ...decorations,
      ...(foreground === undefined ? {} : {
        fg: typeof foreground === "string" ? foreground : rgbColor(...foreground),
      }),
    })));
  }

  clearWidget(key: string): void { this.context().ui.setWidget(key, undefined); }
}
