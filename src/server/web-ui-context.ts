import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { UiPromptResult, WidgetPlacement } from "../shared/protocol.js";
import type { UiPromptRequest } from "./ui-prompt-registry.js";

export type NotificationLevel = "info" | "warning" | "error";

export interface WebUiContextHandlers {
  onNotify: (message: string, level: NotificationLevel) => void;
  onPrompt: (request: UiPromptRequest) => Promise<UiPromptResult>;
  onWidget?: (key: string, lines: string[] | undefined, placement: WidgetPlacement) => void;
  onStatus?: (key: string, text: string | undefined) => void;
}

/**
 * `ctx.ui.theme` is how an extension colours the text it hands to `setStatus`
 * and friends. The browser renders that text as text, so every colour here is
 * the identity function: the label survives, the escape sequences never exist.
 *
 * It has to exist at all because the alternative was a crash. Pi's own RPC mode
 * hands out the real terminal theme, so `ctx.ui.theme.fg("warning", "READONLY")`
 * is the documented way to write a status — and against an absent theme it threw
 * a TypeError that took the whole command down with it.
 */
const plainTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
  italic: (text: string) => text,
  underline: (text: string) => text,
  inverse: (text: string) => text,
  strikethrough: (text: string) => text,
  getFgAnsi: () => "",
  getBgAnsi: () => "",
  getColorMode: () => "truecolor" as const,
  getThinkingBorderColor: () => (text: string) => text,
  getBashModeBorderColor: () => (text: string) => text,
};

/**
 * Extensions talk to the host through `ctx.ui`. Pi installs a no-op context
 * when a host binds none, which is why `ctx.ui.notify(...)` from a command such
 * as `/memory-status` produced no visible output in the browser.
 *
 * This is the browser's stand-in for the methods Pi's RPC extension-UI protocol
 * defines: output, blocking questions, and widgets. What is left inert is the
 * genuinely terminal-shaped surface — footers, headers, editor components, and
 * raw terminal input — which has no serialized form to forward.
 */
export function createWebUiContext({ onNotify, onPrompt, onWidget, onStatus }: WebUiContextHandlers): ExtensionUIContext {
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
    /**
     * A focus-stealing terminal component has no web equivalent. Returning
     * `undefined` is what Pi's own RPC mode does, and it matters: throwing here
     * aborted the extension mid-flight, so a `tool_call` hook that asks for
     * confirmation this way failed the tool call outright instead of falling
     * back to its own default.
     */
    custom: async () => undefined,

    /**
     * Widgets are the one piece of terminal chrome with a serialized form: Pi's
     * RPC protocol carries them as plain lines, and `undefined` clears them.
     * Component factories are a terminal construct and are ignored, exactly as
     * RPC mode ignores them.
     */
    setWidget: (key: string, content: unknown, options?: { placement?: WidgetPlacement }) => {
      if (content !== undefined && !Array.isArray(content)) return;
      onWidget?.(key, content as string[] | undefined, options?.placement ?? "aboveEditor");
    },

    /**
     * Status labels are the terminal's bottom-left footer text, and a browser
     * has a footer too. `undefined` clears, per Pi's contract.
     */
    setStatus: (key: string, text: string | undefined) => onStatus?.(key, text),

    // Terminal-only chrome.
    onTerminalInput: () => noop,
    setWorkingMessage: noop,
    setWorkingVisible: noop,
    setWorkingIndicator: noop,
    setHiddenThinkingLabel: noop,
    setFooter: noop,
    setHeader: noop,
    setTitle: noop,
    pasteToEditor: noop,
    setEditorText: noop,
    getEditorText: () => "",
    addAutocompleteProvider: noop,
    setEditorComponent: noop,
    getEditorComponent: () => undefined,
    theme: plainTheme,
  };

  // The TUI-shaped members above are intentionally inert, so the object cannot
  // satisfy the full terminal contract structurally.
  return context as unknown as ExtensionUIContext;
}
