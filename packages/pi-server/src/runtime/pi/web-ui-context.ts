import { AsyncLocalStorage } from "node:async_hooks";
import type { PromptPresentation, PromptUI } from "@manuelselch/pi-sdk/extension-ui";
import { promptPresentationSchema } from "@manuelselch/pi-sdk/protocol/prompt-presentation.js";
import type { ExtensionUIContext, Theme } from "@earendil-works/pi-coding-agent";
import type { UiPromptResult, WidgetPlacement } from "@manuelselch/pi-sdk/protocol";
import type { UiPromptRequest } from "../../extensions/ui/ui-prompt-registry.js";
import { stripAnsi } from "../../extensions/ui/ansi.js";
import { resolveHeadlessTheme } from "./infra/headless-theme.js";

export type NotificationLevel = "info" | "warning" | "error";

export interface WebUiContextHandlers {
  onNotify: (message: string, level: NotificationLevel) => void;
  onPrompt: (request: UiPromptRequest) => Promise<UiPromptResult>;
  onWidget?: (key: string, lines: string[] | undefined, placement: WidgetPlacement) => void;
  onStatus?: (key: string, text: string | undefined) => void;
}

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
export type WebPromptUIContext = ExtensionUIContext & Required<Pick<PromptUI, "withPromptPresentation">>;

export function createWebUiContext({ onNotify, onPrompt, onWidget, onStatus }: WebUiContextHandlers, theme: Theme = resolveHeadlessTheme("dark", []).theme): WebPromptUIContext {
  const noop = (): void => {};
  const presentation = new AsyncLocalStorage<PromptPresentation>();
  const ask = (request: UiPromptRequest): Promise<UiPromptResult> => {
    const current = presentation.getStore();
    if (request.kind !== "select" && current?.submission !== undefined) {
      throw new Error("Only select prompts accept submission mode");
    }
    const fields = current ? { ...current, ...(current.body ? { body: { ...current.body, text: stripAnsi(current.body.text) } } : {}) } : {};
    return onPrompt({ ...request, ...fields });
  };

  const context = {
    withPromptPresentation: <T>(settings: PromptPresentation, run: () => Promise<T>): Promise<T> =>
      presentation.run(promptPresentationSchema.parse(settings), run),
    notify: (message: string, type: NotificationLevel = "info") => onNotify(stripAnsi(message), type),

    // Blocking questions become modals in the browser. Cancelling maps to the
    // same values the terminal returns when a person dismisses a dialog.
    select: async (title: string, options: string[]) => {
      const result = await ask({ kind: "select", title: stripAnsi(title), options: options.map(stripAnsi), submission: "immediate" });
      return result.cancelled ? undefined : String(result.value);
    },
    confirm: async (title: string, message: string) => {
      const result = await ask({ kind: "confirm", title: stripAnsi(title), message: stripAnsi(message) });
      return result.cancelled ? false : Boolean(result.value);
    },
    input: async (title: string, placeholder?: string) => {
      const result = await ask({ kind: "input", title: stripAnsi(title), ...(placeholder ? { placeholder: stripAnsi(placeholder) } : {}) });
      return result.cancelled ? undefined : String(result.value);
    },
    editor: async (title: string, prefill?: string) => {
      const result = await ask({ kind: "editor", title: stripAnsi(title), ...(prefill ? { prefill: stripAnsi(prefill) } : {}) });
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
    setStatus: (key: string, text: string | undefined) => onStatus?.(key, text === undefined ? undefined : stripAnsi(text)),

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
    theme,
  };

  // The TUI-shaped members above are intentionally inert, so the object cannot
  // satisfy the full terminal contract structurally.
  return context as unknown as WebPromptUIContext;
}
