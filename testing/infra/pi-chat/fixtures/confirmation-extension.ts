import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Explicit, session-local fixture: no model, files, or process-global state. */
export function confirmationExtension(pi: ExtensionAPI): void {
  pi.registerCommand("test-confirm", {
    description: "Ask for confirmation and display the outcome",
    handler: async (_args, ctx) => {
      const confirmed = await ctx.ui.confirm("Apply change?", "Update the test widget?");
      const text = confirmed ? "Change approved" : "Change cancelled";
      ctx.ui.setWidget("test-result", [text], { placement: "belowEditor" });
      ctx.ui.notify(text, confirmed ? "info" : "warning");
    },
  });
}
