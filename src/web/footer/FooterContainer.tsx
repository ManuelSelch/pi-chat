import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useHotkeys, useMediaQuery } from "@mantine/hooks";
import type { Tab } from "../../shared/protocol.js";
import { commandQuery, filterCommands, menuItems, type LocalAction, type MenuItem } from "../commands/command-menu.js";
import { atHome, visibleError } from "../chat/app-state.js";
import { useAppController } from "../state/AppControllerContext.js";
import { useConfirmDialog } from "../dialogs/confirm/ConfirmDialogProvider.js";
import { clearInputIntent } from "../app/shortcuts.js";
import { placeWidgets, WIDGET_DOCK_QUERY } from "../chat/WidgetPanel.js";
import { FooterView } from "./FooterView.js";

interface FooterContainerProps {
  overlayOpen: boolean;
  onHeightChange: (height: number) => void;
  onRename: () => void;
}

const DEFAULT_FOOTER_HEIGHT = 170;

export function FooterContainer({ overlayOpen, onHeightChange, onRename }: FooterContainerProps) {
  const chat = useAppController();
  const { confirm } = useConfirmDialog();
  const { app, state } = chat;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [activeCommand, setActiveCommand] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const home = atHome(app);
  const input = drafts[app.activeSessionId] ?? "";
  const busy = state.status === "running" || state.status === "aborting";
  const connecting = app.connection === "connecting" && app.tabs.length === 0;
  const sessionName = state.actions.features.find((feature) => feature.id === "session.rename")?.state.name?.trim();
  const sessionPath = state.sessionPath;
  const restartFeature = [...state.actions.features, ...app.appFeatures].find((feature) => feature.id === "app.restart");
  const sessionActions: LocalAction[] = [
    { name: "New session", description: "Open a new session in this project", run: () => chat.newSession(state.projectPath || undefined) },
    { name: "Rename session", description: "Set the display name for this session", run: onRename },
    { name: "Close tab", description: "Close this session's tab", run: () => chat.closeTab(app.activeSessionId) },
    ...(sessionPath && !busy ? [{ name: "Delete session", description: "Move this session to the trash and close its tab", run: () => {
      void confirm({ title: "Delete session?", body: `“${sessionName || "This session"}” moves to the trash and its tab closes.`, confirmLabel: "Delete" }).then((yes) => {
        if (yes && sessionPath) return chat.deleteSession(sessionPath);
      });
    } }] : []),
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
  const query = menuDismissed ? undefined : commandQuery(input);
  const matches = query === undefined ? [] : filterCommands(menuItems(sessionActions, state.actions.commands), query);

  function setInput(value: string): void {
    setDrafts((current) => ({ ...current, [app.activeSessionId]: value }));
  }

  function changeInput(value: string): void {
    setInput(value);
    setActiveCommand(0);
    setMenuDismissed(false);
  }

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
    if (item.kind === "action") {
      setInput("");
      setActiveCommand(0);
      item.run();
      return;
    }
    setInput(`/${item.name} `);
    setActiveCommand(0);
  }

  function submit(event?: FormEvent): void {
    event?.preventDefault();
    const message = input.trim();
    if (!message || state.status !== "idle") return;
    chat.prompt(message);
    setInput("");
    setActiveCommand(0);
    setMenuDismissed(false);
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (matches.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveCommand((index) => (index + step + matches.length) % matches.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        runMenuItem(matches[activeCommand]!);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuDismissed(true);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  useLayoutEffect(() => {
    if (home || overlayOpen) return;
    composerRef.current?.focus();
  }, [app.activeSessionId, home, overlayOpen]);

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
    <FooterView
      model={{
        home,
        connection: app.connection,
        connecting,
        error: visibleError(app, state),
        busy,
        input,
        activeCommand,
        matches,
        footerItems,
        widgetsAbove,
        widgetsBelow,
        extensions: state.extensions,
      }}
      actions={{
        takeControl: chat.takeControl,
        dismissError: chat.dismissError,
        changeInput,
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
