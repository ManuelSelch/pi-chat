import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";

export type NotificationLevel = "info" | "warning" | "error";

export interface WebUiContextHandlers {
  onNotify: (message: string, level: NotificationLevel) => void;
}

/**
 * Extensions talk to the host through `ctx.ui`. Pi installs a no-op context
 * when a host binds none, which is why `ctx.ui.notify(...)` from a command such
 * as `/memory-status` produced no visible output in the browser.
 *
 * This is the browser's stand-in. Only output that has a web equivalent is
 * implemented; the TUI surface (widgets, footers, overlays, custom editors)
 * stays inert, and interactive dialogs answer "cancelled" rather than hanging a
 * command that is waiting on a person.
 */
export function createWebUiContext({ onNotify }: WebUiContextHandlers): ExtensionUIContext {
  const noop = (): void => {};

  const context = {
    notify: (message: string, type: NotificationLevel = "info") => onNotify(message, type),

    // No dialog surface yet: resolving instead of rejecting lets a command take
    // its own cancellation path rather than surfacing as a crash.
    select: async () => undefined,
    confirm: async () => false,
    input: async () => undefined,
    editor: async () => undefined,
    custom: async () => {
      throw new Error("Custom terminal components are not available in Pi Chat.");
    },

    // Terminal-only chrome.
    onTerminalInput: () => noop,
    setStatus: noop,
    setWorkingMessage: noop,
    setWorkingVisible: noop,
    setWorkingIndicator: noop,
    setHiddenThinkingLabel: noop,
    setWidget: noop,
    setFooter: noop,
    setHeader: noop,
    setTitle: noop,
    pasteToEditor: noop,
    setEditorText: noop,
    getEditorText: () => "",
    addAutocompleteProvider: noop,
    setEditorComponent: noop,
    getEditorComponent: () => undefined,
    theme: undefined,
  };

  // The TUI-shaped members above are intentionally inert, so the object cannot
  // satisfy the full terminal contract structurally.
  return context as unknown as ExtensionUIContext;
}
