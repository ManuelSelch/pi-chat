import { useCallback, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useHotkeys } from "@mantine/hooks";
import { argumentContext, applyArgumentCompletion } from "./argument-completion.js";
import { useArgumentCompletion } from "./use-argument-completion.js";
import { commandQuery, filterCommands, menuItems, type MenuItem } from "./command-menu.js";
import { atHome, visibleError } from "../../app/state/app-state.js";
import { useAppController } from "../../app/AppControllerContext.js";
import { useSessionActions } from "../../sessions/actions/SessionActionsProvider.js";
import { useOverlays } from "../../app/overlays/OverlayController.js";
import { clearInputIntent } from "../../app/keyboard/shortcuts.js";
import { placeWidgets } from "../../extensions/widgets/widget-placement.js";
import { ComposerView } from "./ComposerView.js";
import { useSessionDrafts } from "../../sessions/drafts/app/SessionDraftProvider.js";
import { focusComposer } from "../../ui/focus/composer-focus.js";

interface ComposerContainerProps {
  onHeightChange: (height: number) => void;
  widgetsDocked: boolean;
}

const DEFAULT_FOOTER_HEIGHT = 170;

export function ComposerContainer({ onHeightChange, widgetsDocked }: ComposerContainerProps) {
  const chat = useAppController();
  const overlays = useOverlays();
  const { actions: sessionActions, error: actionError, clearError: clearActionError } = useSessionActions();
  const { app, state } = chat;
  const { input, setInput: saveDraft } = useSessionDrafts(app.activeSessionId, state.sessionPath);
  const [activeCommand, setActiveCommand] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const [selection, setSelection] = useState({ sessionId: app.activeSessionId, start: 0, end: 0 });
  const [composing, setComposing] = useState(false);
  const pendingCaret = useRef<number | undefined>(undefined);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const home = atHome(app);
  const busy = state.status === "running" || state.status === "aborting";
  const connecting = app.connection === "connecting" && app.tabs.length === 0;
  const loading = app.openingTabs > 0 || !app.activeSessionId;
  const focus = useCallback(() => {
    if (!home && !loading && !overlays.anyOpen && state.prompts.length === 0) focusComposer(composerRef.current);
  }, [home, loading, overlays.anyOpen, state.prompts.length]);

  const footerItems = [
    ...state.footer,
    ...(state.status === "aborting" ? [{ key: "run", text: "stopping…", align: "right" as const, variant: "plain" as const }] : []),
  ];
  const { above: widgetsAbove, below: widgetsBelow } = placeWidgets(
    state.widgets,
    widgetsDocked,
  );
  const canSubmit = !loading && state.prompts.length === 0 && (state.status === "idle" || state.status === "running");
  const query = menuDismissed || !canSubmit ? undefined : commandQuery(input);
  const context = canSubmit && !menuDismissed && !composing && !home && !overlays.anyOpen && state.prompts.length === 0 && app.connection === "open" && selection.sessionId === app.activeSessionId
    ? argumentContext(input, selection.start, selection.end, state.actions.commands)
    : undefined;
  const argumentItems = useArgumentCompletion(app.activeSessionId, input, context, chat.completeCommandArguments);
  const matches: MenuItem[] = query === undefined
    ? argumentItems.map((item) => ({ ...item, kind: "argument" }))
    : filterCommands(menuItems(sessionActions, state.actions.commands), query);
  const activeIndex = Math.min(activeCommand, Math.max(0, matches.length - 1));

  function setInput(value: string, caret = value.length): void {
    if (loading || state.prompts.length > 0) return;
    saveDraft(value);
    setSelection({ sessionId: app.activeSessionId, start: caret, end: caret });
    pendingCaret.current = caret;
  }

  function changeInput(value: string, start = value.length, end = start): void {
    if (loading || state.prompts.length > 0) return;
    saveDraft(value);
    setSelection({ sessionId: app.activeSessionId, start, end });
    setActiveCommand(0);
    setMenuDismissed(false);
  }

  function selectionChanged(): void {
    const textarea = composerRef.current;
    if (!textarea) return;
    if (selection.sessionId === app.activeSessionId && selection.start === textarea.selectionStart && selection.end === textarea.selectionEnd) return;
    setSelection({ sessionId: app.activeSessionId, start: textarea.selectionStart, end: textarea.selectionEnd });
    setActiveCommand(0);
  }

  useLayoutEffect(() => {
    if (pendingCaret.current === undefined) return;
    focus();
    composerRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = undefined;
  }, [input, selection, focus]);

  function openCommandMenu(): void {
    changeInput("/");
    focus();
  }

  useHotkeys(
    [
      ["mod+K", () => { if (!document.querySelector("[role='dialog']")) openCommandMenu(); }],
      ["ctrl+C", () => {
        const hasSelection = Boolean(window.getSelection()?.toString());
        if (clearInputIntent({ hasSelection, input }) === "clear") changeInput("");
      }, { preventDefault: false }],
    ],
    [],
  );

  function runMenuItem(item: MenuItem): void {
    if (item.kind === "argument") {
      if (!context) return;
      const completed = applyArgumentCompletion(input, context, item.value);
      setInput(completed.input, completed.caret);
      setMenuDismissed(true);
      setActiveCommand(0);
      return;
    }
    if (item.kind === "action") {
      setInput("");
      setActiveCommand(0);
      item.run();
      return;
    }
    setInput(`/${item.name} `);
    setMenuDismissed(false);
    setActiveCommand(0);
  }

  function submit(event?: FormEvent): void {
    event?.preventDefault();
    const message = input.trim();
    if (!message || app.connection !== "open" || !canSubmit) return;
    if (state.status === "running" && message.startsWith("!")) return;
    if (message === "/archive") sessionActions.find(action => action.id === "archive-session")?.run();
    else chat.prompt(message);
    setInput("");
    setActiveCommand(0);
    setMenuDismissed(false);
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (composing || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.shiftKey && (event.key === "Enter" || event.key === "Tab")) return;
    if (event.key === "Escape" && (matches.length > 0 || context)) {
      event.preventDefault();
      setMenuDismissed(true);
      return;
    }
    if (matches.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveCommand((index) => (index + step + matches.length) % matches.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        runMenuItem(matches[activeIndex]!);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  const previousReadiness = useRef({ sessionId: app.activeSessionId, loading });
  useLayoutEffect(() => {
    const previous = previousReadiness.current;
    previousReadiness.current = { sessionId: app.activeSessionId, loading };
    // A phone drawer becoming navigation transfers focus into that navigation.
    // Only a real session/readiness change may override that deliberate focus.
    if (previous.sessionId === app.activeSessionId && previous.loading === loading && document.activeElement?.closest("[data-projects-sidebar]")) return;
    // Readiness/tab changes request focus; overlay exit callbacks finish any
    // request blocked by a still-mounted dialog or its exit transition.
    focus();
  }, [app.activeSessionId, loading, focus]);

  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!footer) {
      onHeightChange(DEFAULT_FOOTER_HEIGHT);
      return;
    }
    const measure = () => onHeightChange(footer.getBoundingClientRect().height || DEFAULT_FOOTER_HEIGHT);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(footer);
    return () => observer.disconnect();
  }, [home, onHeightChange]);

  return (
    <ComposerView
      model={{
        home,
        connection: app.connection,
        connecting,
        loading,
        promptPending: state.prompts.length > 0,
        pendingPrompt: chat.promptPresentation.minimized && chat.promptPresentation.prompt ? {
          title: chat.promptPresentation.prompt.title.split("\n")[0]!,
          reopen: chat.promptPresentation.reopen,
          stop: () => chat.abort(),
          stopDisabled: app.connection !== "open" || state.status === "aborting",
        } : undefined,
        error: actionError ?? visibleError(app, state),
        busy,
        steering: state.status === "running",
        steeringMessages: state.steeringMessages,
        input,
        activeCommand: activeIndex,
        matches,
        footerItems,
        widgetsAbove,
        widgetsBelow,
        extensions: state.extensions,
      }}
      actions={{
        takeControl: chat.takeControl,
        dismissError: () => { clearActionError(); chat.dismissError(); },
        changeInput,
        selectionChanged,
        compositionChanged: setComposing,
        keyDown,
        submit,
        setActiveCommand,
        runMenuItem,
        runExtensionAction: chat.runExtensionAction,
      }}
      footerRef={footerRef}
      composerRef={composerRef}
    />
  );
}
