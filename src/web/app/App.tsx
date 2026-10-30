import { useState, type CSSProperties } from "react";
import { AppShell } from "@mantine/core";
import { useViewportSize } from "@mantine/hooks";
import { ConfirmDialogProvider } from "../ui/confirm/ConfirmDialogProvider.js";
import { MessageListContainer } from "../chat/transcript/MessageListContainer.js";
import { WidgetDock } from "../extensions/widgets/WidgetDock.js";
import { placeWidgets } from "../extensions/widgets/widget-placement.js";
import { AppControllerProvider, useAppController } from "./AppControllerContext.js";
import { atHome } from "./state/app-state.js";
import { AppOverlays } from "./overlays/AppOverlays.js";
import { Home } from "../sessions/home/Home.js";
import { HeaderContainer } from "./shell/HeaderContainer.js";
import { ComposerContainer } from "../chat/composer/ComposerContainer.js";
import { OverlayController, useOverlays } from "./overlays/OverlayController.js";
import { SessionActionsProvider } from "../sessions/actions/SessionActionsProvider.js";
import { GlobalKeyboardController } from "./keyboard/GlobalKeyboardController.js";
import { workspaceLayout } from "./shell/domain/workspace-layout.js";

/** Breathing room between the last message and the composer. */
const FOOTER_GAP = 24;

export function App() {
  return (
    <AppControllerProvider>
      <ConfirmDialogProvider>
        <OverlayController>
          <SessionActionsProvider>
            <GlobalKeyboardController />
            <AppContent />
          </SessionActionsProvider>
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
  const { width } = useViewportSize();
  const layout = workspaceLayout(width, overlays.state.projects);
  const { docked: widgetsDocked } = placeWidgets(state.widgets, layout.widgetsDocked);

  return (
    <AppShell header={{ height: 96 }} padding={0} style={{
      "--pi-workspace-left": `${layout.left}px`,
      "--pi-projects-width": layout.sidebarWidth,
    } as CSSProperties}>
      <HeaderContainer />

      {home ? null : <WidgetDock widgets={widgetsDocked} />}

      <AppOverlays />

      <AppShell.Main ml={layout.left} w={`calc(100% - ${layout.left}px)`} pb={home ? 0 : footerHeight + FOOTER_GAP} h={home ? "calc(100dvh - 96px)" : undefined}>
        {home ? (
          <Home
            catalogue={app.catalogue}
            onOpenSession={chat.openSession}
            onOpenProject={chat.openProject}
            onNewSession={() => chat.newSession()}
            onOpenFolder={() => overlays.open("folderPicker")}
          />
        ) : (
          <MessageListContainer footerHeight={footerHeight + FOOTER_GAP} />
        )}
      </AppShell.Main>

      <ComposerContainer onHeightChange={setFooterHeight} widgetsDocked={layout.widgetsDocked} />
    </AppShell>
  );
}
