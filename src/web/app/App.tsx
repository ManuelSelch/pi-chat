import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AppShell, Container } from "@mantine/core";
import { useHotkeys, useMediaQuery } from "@mantine/hooks";
import { commandQuery, filterCommands, menuItems, type LocalAction, type MenuItem } from "../commands/command-menu.js";
import { type Confirmation } from "./ConfirmModal.js";
import { MessageList } from "../chat/MessageList.js";
import { placeWidgets, WidgetDock, WIDGET_DOCK_QUERY } from "../chat/WidgetPanel.js";
import { AppControllerProvider, useAppController } from "../state/AppControllerContext.js";
import { atHome, visibleError } from "../chat/app-state.js";
import { useAutoScroll } from "./use-auto-scroll.js";
import { useChimes } from "./use-chimes.js";
import { useDisplayPath } from "./use-display-path.js";
import { clearInputIntent, escapeIntent } from "./shortcuts.js";
import { ProjectSessionDrawer } from "../projects/ProjectSessionDrawer.js";
import { FolderPicker } from "../projects/FolderPicker.js";
import { Dialogs } from "../dialogs/Dialogs.js";
import { QuickOpen } from "../quickopen/QuickOpen.js";
import { Home } from "../home/Home.js";
import { SettingsDrawer } from "../settings/SettingsDrawer.js";
import { TabBar } from "../tabs/TabBar.js";
import { HeaderContainer } from "../header/HeaderContainer.js";
import { FooterView } from "../footer/FooterView.js";
import type { FooterItem, Tab } from "../../shared/protocol.js";

/** Height of a composer with nothing above it; replaced once measured. */
const DEFAULT_FOOTER_HEIGHT = 170;
/** Breathing room between the last message and the composer. */
const FOOTER_GAP = 24;

export function App() {
  return (
    <AppControllerProvider>
      <AppContent />
    </AppControllerProvider>
  );
}

function AppContent() {
  const chat = useAppController();
  const { app, state, prompt, abort, takeControl, dismissError } = chat;
  // Drafts are per tab: switching away must not discard a half-typed message.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [closing, setClosing] = useState<Tab | undefined>();
  const input = drafts[app.activeSessionId] ?? "";
  const [activeCommand, setActiveCommand] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<Confirmation | undefined>();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  // The composer is fixed to the bottom, so the transcript reserves its height.
  // Widgets, the command menu and error alerts all change it, and a static
  // reservation would let a tall extension panel cover the last messages.
  const [footerHeight, setFooterHeight] = useState(DEFAULT_FOOTER_HEIGHT);
  const busy = state.status === "running" || state.status === "aborting";
  const connecting = app.connection === "connecting" && app.tabs.length === 0;
  // The rename action already carries the live session name, so the header does
  // not need its own snapshot field.
  const renameFeature = state.actions.features.find((feature) => feature.id === "session.rename");
  const sessionName = renameFeature?.state.name?.trim();
  const home = atHome(app);
  const sessionPath = state.sessionPath;
  const restartFeature = [...state.actions.features, ...app.appFeatures].find((feature) => feature.id === "app.restart");
  const sessionActions: LocalAction[] = [
    { name: "New session", description: "Open a new session in this project", run: () => chat.newSession(state.projectPath || undefined) },
    { name: "Rename session", description: "Set the display name for this session", run: () => setRenaming(sessionName ?? "") },
    { name: "Close tab", description: "Close this session's tab", run: () => chat.closeTab(app.activeSessionId) },
    // A session with no file on disk yet has nothing to delete, and a running
    // one is still writing to it.
    ...(sessionPath && !busy
      ? [{
          name: "Delete session",
          description: "Move this session to the trash and close its tab",
          run: () => setConfirming({
            title: "Delete session?",
            body: `“${sessionName || "This session"}” moves to the trash and its tab closes.`,
            confirmLabel: "Delete",
            run: () => chat.deleteSession(sessionPath),
          }),
        }]
      : []),
    ...(restartFeature
      ? [{
          name: "Restart server",
          description: restartFeature.description ?? "Restart the Pi Chat server",
          run: () => setConfirming({
            title: "Restart server?",
            body: "The client is rebuilt and the server restarts. Open sessions close and the page reconnects on its own.",
            confirmLabel: "Restart",
            run: () => chat.restartServer(),
          }),
        }]
      : []),
  ];
  // What the next message will run with is the session's own statement, sent as
  // footer entries; the browser only adds what it alone knows — that a stop it
  // asked for has not landed yet. A running turn says so through the animated
  // border, so the footer stays quiet about it.
  const footerItems: FooterItem[] = [
    ...state.footer,
    ...(state.status === "aborting"
      ? [{ key: "run", text: "stopping…", align: "right" as const, variant: "plain" as const }]
      : []),
  ];
  // Wide enough for the panels to sit in the empty gutter beside the
  // transcript. Narrower windows have no room, so they keep the terminal's own
  // arrangement around the composer.
  const { above: widgetsAbove, below: widgetsBelow, docked: widgetsDocked } = placeWidgets(
    state.widgets,
    useMediaQuery(WIDGET_DOCK_QUERY) ?? false,
  );
  const overlayOpen = quickOpen || projectsOpen || folderPickerOpen || settingsOpen || renaming !== undefined || state.prompts.length > 0;
  const query = menuDismissed ? undefined : commandQuery(input);
  const matches = query === undefined ? [] : filterCommands(menuItems(sessionActions, state.actions.commands), query);
  const menuOpen = matches.length > 0;

  function setInput(value: string): void {
    setDrafts((current) => ({ ...current, [app.activeSessionId]: value }));
  }

  // Escape is contended. Mantine overlays listen on window in the capture phase
  // too, and React flushes their onClose synchronously, so a handler that runs
  // after one of them sees no open dialog and aborts the run behind it. Two
  // defences: useLayoutEffect registers this listener before any child effect
  // does, and a closing dialog is still in the DOM during its exit transition.
  const escapeState = useRef({ overlayOpen: false, menuOpen: false, busy: false, abort });
  escapeState.current = {
    overlayOpen,
    menuOpen,
    busy,
    abort,
  };

  useLayoutEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key !== "Escape") return;
      const current = escapeState.current;
      const overlayOpen = current.overlayOpen || document.querySelector("[role='dialog']") !== null;
      if (escapeIntent({ ...current, overlayOpen }) === "abort") current.abort();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  // Opening or switching to a session should leave the caret ready to type.
  // An overlay on top owns focus, so the composer waits for it to close.
  useEffect(() => {
    if (home || overlayOpen) return;
    composerRef.current?.focus();
  }, [app.activeSessionId, home, overlayOpen]);

  // The footer grows and shrinks on its own: an extension can push a widget at
  // any moment, with no render of this component to hang a measurement on. So
  // its height is observed rather than derived from what is on screen.
  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!footer) {
      setFooterHeight(DEFAULT_FOOTER_HEIGHT);
      return;
    }
    const measure = () => setFooterHeight(footer.getBoundingClientRect().height || DEFAULT_FOOTER_HEIGHT);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(footer);
    return () => observer.disconnect();
  }, [home]);

  function openCommandMenu(): void {
    // Reuses the composer's own slash menu rather than a second palette.
    changeInput("/");
    composerRef.current?.focus();
  }

  // `mod` is Cmd on macOS and Ctrl elsewhere. The empty tag list matters:
  // useHotkeys ignores INPUT/TEXTAREA by default, which would disable these
  // exactly when the composer has focus.
  //
  // Safari owns plain Cmd+O (Open File…) at the menu level and never delivers
  // it to the page, so the palette is bound to Cmd+Shift+O as well;
  // Cmd+O is kept for browsers that do hand it over. Cmd+K is safe everywhere
  // because no browser claims it.
  useHotkeys(
    [
      // The home screen is the palette, so opening it over itself would stack
      // two identical search fields.
      ["mod+shift+O", () => { if (!home) setQuickOpen(true); }],
      ["mod+O", () => { if (!home) setQuickOpen(true); }],
      // Context matters: inside the palette Cmd+K must not hijack the search.
      ["mod+K", () => { if (!quickOpen) openCommandMenu(); }],
      // preventDefault stays off so Ctrl+C remains Copy when text is selected.
      [
        "ctrl+C",
        () => {
          const hasSelection = Boolean(window.getSelection()?.toString());
          if (clearInputIntent({ hasSelection, input }) === "clear") changeInput("");
        },
        { preventDefault: false },
      ],
    ],
    [],
  );

  function changeInput(value: string): void {
    setInput(value);
    setActiveCommand(0);
    setMenuDismissed(false);
  }

  function runMenuItem(item: MenuItem): void {
    if (item.kind === "action") {
      // The menu was opened by typing "/", so the composer has to be cleared.
      setInput("");
      setActiveCommand(0);
      item.run();
      return;
    }
    // A trailing space both closes the menu and starts the argument.
    setInput(`/${item.name} `);
    setActiveCommand(0);
  }
  const chimes = useChimes(app.tabs);
  const displayPath = useDisplayPath();
  // Reasoning counts as growth too: a turn that thinks before it writes grows
  // the page by the whole thinking panel, and following only `text` left the
  // live reasoning drifting below the fold.
  const followKey = `${state.messages.length}:${state.messages.at(-1)?.id ?? ""}:${state.draft?.text.length ?? 0}:${state.draft?.thinking.length ?? 0}:${state.status}`;
  const bottomRef = useAutoScroll({ sessionId: state.sessionId, followKey });

  function submit(event?: FormEvent): void {
    event?.preventDefault();
    const message = input.trim();
    if (!message || state.status !== "idle") return;
    prompt(message);
    setInput("");
    setActiveCommand(0);
    setMenuDismissed(false);
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (menuOpen) {
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

  return (
    <AppShell header={{ height: 96 }} padding={0}>
      <HeaderContainer
        onOpenProjects={() => setProjectsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onRequestCloseRunning={setClosing}
      />

      {home ? null : <WidgetDock widgets={widgetsDocked} />}

      <Dialogs
        closing={closing}
        onClosingChange={setClosing}
        confirming={confirming}
        onConfirmingChange={setConfirming}
        renaming={renaming}
        onRenamingChange={setRenaming}
        prompt={state.prompts.at(-1)}
        onRespondToPrompt={chat.respondToPrompt}
        closeTab={chat.closeTab}
        renameSession={chat.renameSession}
      />
      <QuickOpen
        opened={quickOpen}
        onClose={() => setQuickOpen(false)}
        catalogue={app.catalogue}
        tabs={app.tabs}
        onOpenSession={chat.openSession}
        onOpenProject={chat.openProject}
      />

      <ProjectSessionDrawer
        opened={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        state={state}
        catalogue={app.catalogue}
        busy={busy}
        showDisplayPath={displayPath.show}
        openSession={chat.openSession}
        newSession={chat.newSession}
        deleteSession={chat.deleteSession}
        onOpenFolder={() => setFolderPickerOpen(true)}
      />
      <FolderPicker
        opened={folderPickerOpen}
        connected={app.connection === "open"}
        initialPath={state.projectPath || undefined}
        onClose={() => setFolderPickerOpen(false)}
        browseDirectories={chat.browseDirectories}
        startSession={chat.startFolderSession}
      />
      <SettingsDrawer
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        state={state}
        busy={busy}
        renameSession={chat.renameSession}
        setThinkingLevel={chat.setThinkingLevel}
        setModel={chat.setModel}
        compactSession={chat.compactSession}
        appFeatures={app.appFeatures}
        chimesEnabled={chimes.enabled}
        setChimesEnabled={chimes.setEnabled}
        chimesAvailable={chimes.available}
        displayPathShow={displayPath.show}
        setDisplayPathShow={displayPath.setShow}
        runExtensionAction={chat.runExtensionAction}
        restartServer={() => setConfirming({
          title: "Restart server?",
          body: "The client is rebuilt and the server restarts. Open sessions close and the page reconnects on its own.",
          confirmLabel: "Restart",
          run: () => chat.restartServer(),
        })}
      />

      <AppShell.Main pb={home ? 0 : footerHeight + FOOTER_GAP} h={home ? "calc(100dvh - 96px)" : undefined}>
        {home ? (
          <Home
            catalogue={app.catalogue}
            onOpenSession={chat.openSession}
            onOpenProject={chat.openProject}
            onNewSession={() => chat.newSession()}
            onOpenFolder={() => setFolderPickerOpen(true)}
          />
        ) : (
          <Container size="sm" py="xl">
            <MessageList key={state.sessionId} messages={state.messages} draft={state.draft} />
            <div ref={bottomRef} aria-hidden="true" style={{ scrollMarginBottom: footerHeight + FOOTER_GAP }} />
          </Container>
        )}
      </AppShell.Main>

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
          takeControl,
          dismissError,
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
    </AppShell>
  );
}
