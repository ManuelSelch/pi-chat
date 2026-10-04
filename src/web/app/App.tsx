import { useState } from "react";
import { AppShell } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { ConfirmDialogProvider } from "../ui/confirm/ConfirmDialogProvider.js";
import { MessageListContainer } from "../chat/transcript/MessageListContainer.js";
import { WidgetDock } from "../extensions/widgets/WidgetDock.js";
import { placeWidgets, WIDGET_DOCK_QUERY } from "../extensions/widgets/widget-placement.js";
import { AppControllerProvider, useAppController } from "./AppControllerContext.js";
import { atHome } from "./state/app-state.js";
import { AppOverlays } from "./overlays/AppOverlays.js";
import { Home } from "../sessions/home/Home.js";
import { HeaderContainer } from "./shell/HeaderContainer.js";
import { ComposerContainer } from "../chat/composer/ComposerContainer.js";
import { OverlayController, useOverlays } from "./overlays/OverlayController.js";
import { GlobalKeyboardController } from "./keyboard/GlobalKeyboardController.js";

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

  return (
    <AppShell header={{ height: 96 }} padding={0}>
      <HeaderContainer />

      {home ? null : <WidgetDock widgets={widgetsDocked} />}

      <AppOverlays />

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
          <MessageListContainer footerHeight={footerHeight + FOOTER_GAP} />
        )}
      </AppShell.Main>

      <ComposerContainer onHeightChange={setFooterHeight} />
    </AppShell>
  );
}
