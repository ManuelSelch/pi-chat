import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ActionIcon, Alert, Anchor, AppShell, Box, Button, Container, Group, Modal, Paper, Stack, Text, Textarea, TextInput, Tooltip } from "@mantine/core";
import { useHotkeys, useMediaQuery } from "@mantine/hooks";
import { IconArrowUp, IconLayoutSidebar, IconPlayerStopFilled, IconSettings } from "@tabler/icons-react";
import { CommandMenu } from "../commands/CommandMenu.js";
import { commandQuery, filterCommands, menuItems, type LocalAction, type MenuItem } from "../commands/command-menu.js";
import { ConfirmModal, type Confirmation } from "./ConfirmModal.js";
import { MessageList } from "../chat/MessageList.js";
import { placeWidgets, WidgetDock, WidgetPanel, WIDGET_DOCK_QUERY } from "../chat/WidgetPanel.js";
import { usePiChat } from "../chat/use-pi-chat.js";
import { atHome, visibleError, visibleTabs } from "../chat/app-state.js";
import { useAutoScroll } from "./use-auto-scroll.js";
import { useChimes } from "./use-chimes.js";
import { clearInputIntent, escapeIntent } from "./shortcuts.js";
import { ProjectSessionDrawer } from "../projects/ProjectSessionDrawer.js";
import { PromptModal } from "../prompts/PromptModal.js";
import { QuickOpen } from "../quickopen/QuickOpen.js";
import { Home } from "../home/Home.js";
import { SettingsDrawer } from "../settings/SettingsDrawer.js";
import { TabBar } from "../tabs/TabBar.js";
import type { Tab } from "../../shared/protocol.js";

/** Height of a composer with nothing above it; replaced once measured. */
const DEFAULT_FOOTER_HEIGHT = 170;
/** Breathing room between the last message and the composer. */
const FOOTER_GAP = 24;

export function App() {
  const chat = usePiChat();
  const { app, state, prompt, abort, takeControl, dismissError } = chat;
  // Drafts are per tab: switching away must not discard a half-typed message.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [closing, setClosing] = useState<Tab | undefined>();
  const input = drafts[app.activeSessionId] ?? "";
  const [activeCommand, setActiveCommand] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
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
  const headerTitle = home ? "No session open" : state.projectPath ? sessionName || "New session" : "Connecting…";
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
  // The composer footer shows what the next message will run with instead of
  // keyboard hints; a feature the server does not advertise is simply omitted.
  const modelName = state.actions.features.find((feature) => feature.id === "model.select")?.state.value;
  const thinkingLevel = state.actions.features.find((feature) => feature.id === "thinking.level")?.state.value;
  const composerStatus = [modelName, thinkingLevel ? `thinking: ${thinkingLevel}` : undefined].filter(Boolean).join(" · ");
  // Wide enough for the panels to sit in the empty gutter beside the
  // transcript. Narrower windows have no room, so they keep the terminal's own
  // arrangement around the composer.
  const { above: widgetsAbove, below: widgetsBelow, docked: widgetsDocked } = placeWidgets(
    state.widgets,
    useMediaQuery(WIDGET_DOCK_QUERY) ?? false,
  );
  const overlayOpen = quickOpen || projectsOpen || settingsOpen || renaming !== undefined || state.prompts.length > 0;
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
  const followKey = `${state.messages.length}:${state.messages.at(-1)?.id ?? ""}:${state.draft?.text.length ?? 0}:${state.status}`;
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
      <AppShell.Header>
        <Group h={58} px="lg" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <Tooltip label="Projects and sessions">
              <ActionIcon variant="subtle" color="gray" aria-label="Projects and sessions" onClick={() => setProjectsOpen(true)}>
                <IconLayoutSidebar size={18} />
              </ActionIcon>
            </Tooltip>
            <Text c="dimmed" size="xs" truncate title={state.projectPath}>{headerTitle}</Text>
          </Group>
          <Group gap="sm" wrap="nowrap">
            {home ? null : (
              <Text c={state.status === "running" ? "green" : "dimmed"} size="xs" tt="capitalize" data-testid="status">
                {state.status}
              </Text>
            )}
            <Tooltip label="Settings">
              <ActionIcon variant="subtle" color="gray" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
                <IconSettings size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        <TabBar
          tabs={visibleTabs(app)}
          opening={app.openingTabs}
          activeSessionId={app.activeSessionId}
          onFocus={chat.focusTab}
          onClose={(tab) => (tab.status === "idle" ? chat.closeTab(tab.sessionId) : setClosing(tab))}
          onNew={() => chat.newSession(state.projectPath || undefined)}
        />
      </AppShell.Header>

      {home ? null : <WidgetDock widgets={widgetsDocked} />}

      {/* Nested prompts stack, so the newest question is the one answered.
          Only the focused tab shows its modal; background tabs go red instead. */}
      <PromptModal prompt={state.prompts.at(-1)} onRespond={chat.respondToPrompt} />

      <Modal opened={Boolean(closing)} onClose={() => setClosing(undefined)} title="Close running session?" centered size="sm">
        <Stack gap="md">
          <Text size="sm">
            “{closing?.title}” is still running. Closing stops the run.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setClosing(undefined)}>Keep open</Button>
            <Button color="red" onClick={() => { chat.closeTab(closing!.sessionId); setClosing(undefined); }}>
              Stop and close
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal confirmation={confirming} onClose={() => setConfirming(undefined)} />

      <Modal opened={renaming !== undefined} onClose={() => setRenaming(undefined)} title="Rename session" centered size="sm">
        <Stack gap="md">
          <TextInput
            data-autofocus
            aria-label="Session name"
            value={renaming ?? ""}
            onChange={(event) => setRenaming(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !renaming?.trim()) return;
              event.preventDefault();
              chat.renameSession(renaming.trim());
              setRenaming(undefined);
            }}
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setRenaming(undefined)}>Cancel</Button>
            <Button
              disabled={!renaming?.trim()}
              onClick={() => { chat.renameSession(renaming!.trim()); setRenaming(undefined); }}
            >
              Rename
            </Button>
          </Group>
        </Stack>
      </Modal>

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
        openSession={chat.openSession}
        newSession={chat.newSession}
        deleteSession={chat.deleteSession}
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
          />
        ) : (
          <Container size="sm" py="xl">
            <MessageList key={state.sessionId} messages={state.messages} draft={state.draft} />
            <div ref={bottomRef} aria-hidden="true" style={{ scrollMarginBottom: footerHeight + FOOTER_GAP }} />
          </Container>
        )}
      </AppShell.Main>

      {home ? null : (
      <Box
        component="footer"
        ref={footerRef}
        pos="fixed"
        bottom={0}
        left={0}
        right={0}
        pb="md"
        style={{ background: "linear-gradient(transparent, var(--mantine-color-body) 30%)", pointerEvents: "none" }}
      >
        <Container size="sm" style={{ pointerEvents: "auto" }}>
          {app.connection === "superseded" ? (
            <Text size="sm" c="dimmed" mb="xs">
              Another browser tab is using this Pi session. <Anchor component="button" type="button" onClick={takeControl}>Take control here</Anchor>
            </Text>
          ) : connecting ? (
            <Text size="sm" c="dimmed" mb="xs">Connecting to the Pi Chat server… the runtime takes a few seconds to start.</Text>
          ) : null}

          {/* Shown next to the reconnect notice rather than instead of it: a
              failed turn stays relevant while the socket is coming back. */}
          {visibleError(app, state) ? (
            <Alert
              color="red"
              variant="light"
              mb="xs"
              role="alert"
              withCloseButton
              closeButtonLabel="Dismiss error"
              onClose={() => dismissError()}
              styles={{ message: { whiteSpace: "pre-wrap", wordBreak: "break-word" } }}
            >
              {visibleError(app, state)}
            </Alert>
          ) : null}

          {/* Extension panels sit where the terminal puts them: around the
              editor, which here is the composer. */}
          <WidgetPanel widgets={widgetsAbove} />

          {menuOpen ? (
            <CommandMenu
              commands={matches}
              activeIndex={activeCommand}
              onHover={setActiveCommand}
              onSelect={runMenuItem}
            />
          ) : null}

          <Paper component="form" onSubmit={submit} withBorder radius="lg" p="xs" shadow="md">
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <Textarea
                ref={composerRef}
                aria-label="Message Pi"
                autosize
                minRows={2}
                maxRows={8}
                onChange={(event) => changeInput(event.currentTarget.value)}
                onKeyDown={keyDown}
                placeholder="Ask Pi anything…"
                value={input}
                variant="unstyled"
                flex={1}
                styles={{ input: { padding: "8px 10px" } }}
              />
              {busy ? (
                <ActionIcon color="red" radius="xl" size="lg" aria-label="Stop" disabled={state.status === "aborting"} onClick={() => abort()} type="button">
                  <IconPlayerStopFilled size={16} />
                </ActionIcon>
              ) : (
                <ActionIcon radius="xl" size="lg" aria-label="Send" disabled={!input.trim() || state.status !== "idle"} type="submit">
                  <IconArrowUp size={18} />
                </ActionIcon>
              )}
            </Group>
          </Paper>
          {widgetsBelow.length > 0 ? (
            <Box mt="xs">
              <WidgetPanel widgets={widgetsBelow} />
            </Box>
          ) : null}

          {composerStatus ? <Text size="xs" c="dimmed" mt={6} pl={12}>{composerStatus}</Text> : null}
        </Container>
      </Box>
      )}
    </AppShell>
  );
}
