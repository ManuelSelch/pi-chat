import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";

/** Real extension API and host theme; no model calls or fabricated presentation events. */
export const coloredWidgetExtension: ExtensionFactory = pi => {
  for (const [command, color] of [["widget-show", "success"], ["widget-error", "error"]] as const) {
    pi.registerCommand(command, {
      description: "Show a themed widget fixture",
      handler: async (_args, ctx) => {
        const theme = ctx.ui.theme;
        ctx.ui.setWidget("status", [
          theme.fg(color, theme.bold(theme.italic(theme.underline(theme.strikethrough("Status"))))),
          "\u001b[38;2;12;34;56mfirst",
          "  second 😀\u001b[0m",
          "",
          "[Frontend](https://example.com)",
          '<img src=x onerror="alert(1)">',
          "longword".repeat(30),
          "\u001b[0m",
        ]);
      },
    });
  }
  pi.registerCommand("widget-clear", {
    description: "Clear the widget fixture",
    handler: async (_args, ctx) => { ctx.ui.setWidget("status", undefined); },
  });
};
