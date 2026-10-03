import { useState } from "react";
import { AppShell, Container } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { ConfirmDialogProvider } from "../dialogs/confirm/ConfirmDialogProvider.js";
import { MessageList } from "../chat/MessageList.js";
import { placeWidgets, WidgetDock, WIDGET_DOCK_QUERY } from "../chat/WidgetPanel.js";
import { AppControllerProvider, useAppController } from "../state/AppControllerContext.js";
import { atHome } from "../chat/app-state.js";
import { useAutoScroll } from "./use-auto-scroll.js";
import { ProjectSessionContainer } from "../projects/ProjectSessionContainer.js";
import { FolderPickerContainer } from "../projects/FolderPickerContainer.js";
import { Dialogs } from "../dialogs/Dialogs.js";
import { QuickOpenContainer } from "../quickopen/QuickOpenContainer.js";
import { Home } from "../home/Home.js";
import { SettingsContainer } from "../settings/SettingsContainer.js";
import { TabBar } from "../tabs/TabBar.js";
import { HeaderContainer } from "../header/HeaderContainer.js";
import { FooterContainer } from "../footer/FooterContainer.js";
import { OverlayController, useOverlays } from "../overlays/OverlayController.js";
import { GlobalKeyboardController } from "../shortcuts/GlobalKeyboardController.js";

/** Breathing room between the last message and the composer. */
const FOOTER_GAP = 24;

export function App() {
  return (
    <AppControllerProvider>
      <ConfirmDialogProvider>
        <OverlayController>
          <GlobalKeyboardController />
          <AppContent />
        </OverlayController>
      </ConfirmDialogProvider>
    </AppControllerProvider>
  );
}

function AppContent() {
  const chat = useAppController();
  const { app, state } = chat;
  const overlays = useOverlays();
  const [footerHeight, setFooterHeight] = useState(170);
  const home = atHome(app);
  const { docked: widgetsDocked } = placeWidgets(
    state.widgets,
    useMediaQuery(WIDGET_DOCK_QUERY) ?? false,
  );

    // Reasoning counts as growth too: a turn that thinks before it writes grows
  // the page by the whole thinking panel, and following only `text` left the
  // live reasoning drifting below the fold.
  const followKey = `${state.messages.length}:${state.messages.at(-1)?.id ?? ""}:${state.draft?.text.length ?? 0}:${state.draft?.thinking.length ?? 0}:${state.status}`;
  const bottomRef = useAutoScroll({ sessionId: state.sessionId, followKey });

  return (
    <AppShell header={{ height: 96 }} padding={0}>
      <HeaderContainer />

      {home ? null : <WidgetDock widgets={widgetsDocked} />}

      <Dialogs
        prompt={state.prompts.at(-1)}
        onRespondToPrompt={chat.respondToPrompt}
        closeTab={chat.closeTab}
        renameSession={chat.renameSession}
      />
      <QuickOpenContainer />

      <ProjectSessionContainer />
      <FolderPickerContainer />
      <SettingsContainer />

      <AppShell.Main pb={home ? 0 : footerHeight + FOOTER_GAP} h={home ? "calc(100dvh - 96px)" : undefined}>
        {home ? (
          <Home
            catalogue={app.catalogue}
            onOpenSession={chat.openSession}
            onOpenProject={chat.openProject}
            onNewSession={() => chat.newSession()}
            onOpenFolder={() => overlays.open("folderPicker")}
          />
        ) : (
          <Container size="sm" py="xl">
            <MessageList key={state.sessionId} messages={state.messages} draft={state.draft} />
            <div ref={bottomRef} aria-hidden="true" style={{ scrollMarginBottom: footerHeight + FOOTER_GAP }} />
          </Container>
        )}
      </AppShell.Main>

      <FooterContainer onHeightChange={setFooterHeight} />
    </AppShell>
  );
}
