import { useLayoutEffect, useRef, useState } from "react";
import { AppShell, Container } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { type Confirmation } from "./ConfirmModal.js";
import { MessageList } from "../chat/MessageList.js";
import { placeWidgets, WidgetDock, WIDGET_DOCK_QUERY } from "../chat/WidgetPanel.js";
import { AppControllerProvider, useAppController } from "../state/AppControllerContext.js";
import { atHome } from "../chat/app-state.js";
import { useAutoScroll } from "./use-auto-scroll.js";
import { useChimes } from "./use-chimes.js";
import { useDisplayPath } from "./use-display-path.js";
import { escapeIntent } from "./shortcuts.js";
import { ProjectSessionDrawer } from "../projects/ProjectSessionDrawer.js";
import { FolderPicker } from "../projects/FolderPicker.js";
import { Dialogs } from "../dialogs/Dialogs.js";
import { QuickOpen } from "../quickopen/QuickOpen.js";
import { Home } from "../home/Home.js";
import { SettingsDrawer } from "../settings/SettingsDrawer.js";
import { TabBar } from "../tabs/TabBar.js";
import { HeaderContainer } from "../header/HeaderContainer.js";
import { FooterContainer } from "../footer/FooterContainer.js";
import type { Tab } from "../../shared/protocol.js";

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
  const { app, state } = chat;
  const [closing, setClosing] = useState<Tab | undefined>();
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<Confirmation | undefined>();
  const [footerHeight, setFooterHeight] = useState(170);
  const busy = state.status === "running" || state.status === "aborting";
  const connecting = app.connection === "connecting" && app.tabs.length === 0;
  // The rename action already carries the live session name, so the header does
  // not need its own snapshot field.
  const renameFeature = state.actions.features.find((feature) => feature.id === "session.rename");
  const sessionName = renameFeature?.state.name?.trim();
  const home = atHome(app);
  const { docked: widgetsDocked } = placeWidgets(
    state.widgets,
    useMediaQuery(WIDGET_DOCK_QUERY) ?? false,
  );
  const overlayOpen = quickOpen || projectsOpen || folderPickerOpen || settingsOpen || renaming !== undefined || state.prompts.length > 0;

  // Escape is contended. Mantine overlays listen on window in the capture phase
  // too, and React flushes their onClose synchronously, so a handler that runs
  // after one of them sees no open dialog and aborts the run behind it. Two
  // defences: useLayoutEffect registers this listener before any child effect
  // does, and a closing dialog is still in the DOM during its exit transition.
  const escapeState = useRef({ overlayOpen: false, menuOpen: false, busy: false, abort: chat.abort });
  escapeState.current = {
    overlayOpen,
    menuOpen: false,
    busy,
    abort: chat.abort,
  };

  useLayoutEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key !== "Escape") return;
      const current = escapeState.current;
      const overlayOpen = current.overlayOpen || document.querySelector("[role='dialog']") !== null;
      const menuOpen = document.querySelector("[data-command-menu]") !== null;
      if (escapeIntent({ ...current, overlayOpen, menuOpen }) === "abort") current.abort();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

    const chimes = useChimes(app.tabs);
  const displayPath = useDisplayPath();
  // Reasoning counts as growth too: a turn that thinks before it writes grows
  // the page by the whole thinking panel, and following only `text` left the
  // live reasoning drifting below the fold.
  const followKey = `${state.messages.length}:${state.messages.at(-1)?.id ?? ""}:${state.draft?.text.length ?? 0}:${state.draft?.thinking.length ?? 0}:${state.status}`;
  const bottomRef = useAutoScroll({ sessionId: state.sessionId, followKey });

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

      <FooterContainer
        overlayOpen={overlayOpen}
        quickOpen={quickOpen}
        onOpenQuickOpen={() => setQuickOpen(true)}
        onHeightChange={setFooterHeight}
        onRename={() => setRenaming(sessionName ?? "")}
        onDelete={() => setConfirming({
          title: "Delete session?",
          body: `“${sessionName || "This session"}” moves to the trash and its tab closes.`,
          confirmLabel: "Delete",
          run: () => { if (state.sessionPath) void chat.deleteSession(state.sessionPath); },
        })}
        onRestart={() => setConfirming({
          title: "Restart server?",
          body: "The client is rebuilt and the server restarts. Open sessions close and the page reconnects on its own.",
          confirmLabel: "Restart",
          run: () => void chat.restartServer(),
        })}
      />
    </AppShell>
  );
}
