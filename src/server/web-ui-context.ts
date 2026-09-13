import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { UiPromptResult } from "../shared/protocol.js";
import type { UiPromptRequest } from "./ui-prompt-registry.js";

export type NotificationLevel = "info" | "warning" | "error";

export interface WebUiContextHandlers {
  onNotify: (message: string, level: NotificationLevel) => void;
  onPrompt: (request: UiPromptRequest) => Promise<UiPromptResult>;
}

/**
 * Extensions talk to the host through `ctx.ui`. Pi installs a no-op context
 * when a host binds none, which is why `ctx.ui.notify(...)` from a command such
 * as `/memory-status` produced no visible output in the browser.
 *
 * This is the browser's stand-in. Output and blocking questions are forwarded
 * to the browser; the TUI surface (widgets, footers, overlays, custom editors)
 * stays inert.
 */
export function createWebUiContext({ onNotify, onPrompt }: WebUiContextHandlers): ExtensionUIContext {
  const noop = (): void => {};

  const context = {
    notify: (message: string, type: NotificationLevel = "info") => onNotify(message, type),

    // Blocking questions become modals in the browser. Cancelling maps to the
    // same values the terminal returns when a person dismisses a dialog.
    select: async (title: string, options: string[]) => {
      const result = await onPrompt({ kind: "select", title, options });
      return result.cancelled ? undefined : String(result.value);
    },
    confirm: async (title: string, message: string) => {
      const result = await onPrompt({ kind: "confirm", title, message });
      return result.cancelled ? false : Boolean(result.value);
    },
    input: async (title: string, placeholder?: string) => {
      const result = await onPrompt({ kind: "input", title, ...(placeholder ? { placeholder } : {}) });
      return result.cancelled ? undefined : String(result.value);
    },
    editor: async (title: string, prefill?: string) => {
      const result = await onPrompt({ kind: "editor", title, ...(prefill ? { prefill } : {}) });
      return result.cancelled ? undefined : String(result.value);
    },
    // Needs a terminal component factory, so it has no web equivalent.
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
