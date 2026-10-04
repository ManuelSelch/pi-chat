import { useState } from "react";
import { AppShell } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { ConfirmDialogProvider } from "../ui/confirm/ConfirmDialogProvider.js";
import { MessageListContainer } from "../chat/transcript/MessageListContainer.js";
import { placeWidgets, WidgetDock, WIDGET_DOCK_QUERY } from "../chat/WidgetPanel.js";
import { AppControllerProvider, useAppController } from "./AppControllerContext.js";
import { atHome } from "./state/app-state.js";
import { ProjectSessionContainer } from "../sessions/projects/ProjectSessionContainer.js";
import { FolderPickerContainer } from "../sessions/folders/FolderPickerContainer.js";
import { Dialogs } from "../dialogs/Dialogs.js";
import { QuickOpenContainer } from "../sessions/quick-open/QuickOpenContainer.js";
import { Home } from "../sessions/home/Home.js";
import { SettingsContainer } from "../settings/SettingsContainer.js";
import { TabBar } from "../sessions/tabs/TabBar.js";
import { HeaderContainer } from "../header/HeaderContainer.js";
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
          <MessageListContainer footerHeight={footerHeight + FOOTER_GAP} />
        )}
      </AppShell.Main>

      <ComposerContainer onHeightChange={setFooterHeight} />
    </AppShell>
  );
}
