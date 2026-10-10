import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useHotkeys, useMediaQuery } from "@mantine/hooks";
import { argumentContext, applyArgumentCompletion } from "./argument-completion.js";
import { useArgumentCompletion } from "./use-argument-completion.js";
import { commandQuery, filterCommands, menuItems, type LocalAction, type MenuItem } from "./command-menu.js";
import { atHome, visibleError } from "../../app/state/app-state.js";
import { useAppController } from "../../app/AppControllerContext.js";
import { useConfirmDialog } from "../../ui/confirm/ConfirmDialogProvider.js";
import { useOverlays } from "../../app/overlays/OverlayController.js";
import { clearInputIntent } from "../../app/keyboard/shortcuts.js";
import { placeWidgets, WIDGET_DOCK_QUERY } from "../../extensions/widgets/widget-placement.js";
import { ComposerView } from "./ComposerView.js";

interface ComposerContainerProps {
  onHeightChange: (height: number) => void;
}

const DEFAULT_FOOTER_HEIGHT = 170;

export function ComposerContainer({ onHeightChange }: ComposerContainerProps) {
  const chat = useAppController();
  const overlays = useOverlays();
  const { confirm } = useConfirmDialog();
  const { app, state } = chat;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [activeCommand, setActiveCommand] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const [selection, setSelection] = useState({ sessionId: app.activeSessionId, start: 0, end: 0 });
  const [composing, setComposing] = useState(false);
  const [archiveError, setArchiveError] = useState<{ sessionId: string; message: string }>();
  const pendingCaret = useRef<number | undefined>(undefined);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const home = atHome(app);
  const input = drafts[app.activeSessionId] ?? "";
  const busy = state.status === "running" || state.status === "aborting";
  const connecting = app.connection === "connecting" && app.tabs.length === 0;
  const sessionPath = state.sessionPath;
  function archive(): void {
    if (!sessionPath || busy) return;
    const sessionId = app.activeSessionId;
    setArchiveError(undefined);
    void chat.archiveSession(sessionPath, true).catch((error: unknown) => {
      setArchiveError({ sessionId, message: error instanceof Error ? error.message : String(error) });
    });
  }
  const restartFeature = [...state.actions.features, ...app.appFeatures].find((feature) => feature.id === "app.restart");
  const sessionActions: LocalAction[] = [
    { name: "New session", description: "Open a new session in this project", run: () => chat.newSession(state.projectPath || undefined) },
    { name: "Close tab", description: "Close this session's tab", run: () => chat.closeTab(app.activeSessionId) },
    ...(sessionPath && !busy ? [{ name: "Archive session", description: "Keep this session in Archived and close its tab", run: archive }] : []),
    ...(restartFeature ? [{ name: "Restart server", description: restartFeature.description ?? "Restart the Pi Chat server", run: () => {
      void confirm({ title: "Restart server?", body: "The client is rebuilt and the server restarts. Open sessions close and the page reconnects on its own.", confirmLabel: "Restart" }).then((yes) => {
        if (yes) return chat.restartServer();
      });
    } }] : []),
  ];
  const footerItems = [
    ...state.footer,
    ...(state.status === "aborting" ? [{ key: "run", text: "stopping…", align: "right" as const, variant: "plain" as const }] : []),
  ];
  const { above: widgetsAbove, below: widgetsBelow } = placeWidgets(
    state.widgets,
    useMediaQuery(WIDGET_DOCK_QUERY) ?? false,
  );
  const query = menuDismissed || busy ? undefined : commandQuery(input);
  const context = !busy && !menuDismissed && !composing && !home && !overlays.anyOpen && state.prompts.length === 0 && app.connection === "open" && selection.sessionId === app.activeSessionId
    ? argumentContext(input, selection.start, selection.end, state.actions.commands)
    : undefined;
  const argumentItems = useArgumentCompletion(app.activeSessionId, input, context, chat.completeCommandArguments);
  const matches: MenuItem[] = query === undefined
    ? argumentItems.map((item) => ({ ...item, kind: "argument" }))
    : filterCommands(menuItems(sessionActions, state.actions.commands), query);
  const activeIndex = Math.min(activeCommand, Math.max(0, matches.length - 1));

  function setInput(value: string, caret = value.length): void {
    setDrafts((current) => ({ ...current, [app.activeSessionId]: value }));
    setSelection({ sessionId: app.activeSessionId, start: caret, end: caret });
    pendingCaret.current = caret;
  }

  function changeInput(value: string, start = value.length, end = start): void {
    setDrafts((current) => ({ ...current, [app.activeSessionId]: value }));
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
    composerRef.current?.focus();
    composerRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = undefined;
  }, [input, selection]);

  function openCommandMenu(): void {
    changeInput("/");
    composerRef.current?.focus();
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
    if (!message || app.connection !== "open" || (state.status !== "idle" && state.status !== "running")) return;
    if (state.status === "running" && /^[!/]/.test(message)) return;
    if (message === "/archive") archive();
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

  useLayoutEffect(() => {
    // A prompt can linger during handover after state.prompts becomes empty;
    // other portalled dialogs (including confirmations) also still own focus.
    if (home || overlays.anyOpen || state.prompts.length > 0 || document.querySelector('[role="dialog"]')) return;
    composerRef.current?.focus();
  }, [app.activeSessionId, home, overlays.anyOpen, state.prompts.length]);

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
        error: archiveError?.sessionId === app.activeSessionId ? archiveError.message : visibleError(app, state),
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
        dismissError: () => { setArchiveError(undefined); chat.dismissError(); },
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
