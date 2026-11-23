import { useState, type CSSProperties } from "react";
import { AgentationFeedback } from "../features/settings/components/AgentationFeedback.js";
import { AppShell } from "@mantine/core";
import { useViewportSize } from "@mantine/hooks";
import { ConfirmDialogProvider } from "../components/confirm/ConfirmDialogProvider.js";
import { MessageListContainer } from "../features/chat/transcript/components/MessageListContainer.js";
import { WidgetDock } from "../features/extensions/widgets/components/WidgetDock.js";
import { WidgetDisclosureProvider } from "../features/extensions/widgets/stores/WidgetDisclosureProvider.js";
import { placeWidgets } from "../features/extensions/widgets/utils/widget-placement.js";
import { AppControllerProvider, useAppController } from "./AppControllerContext.js";
import { atHome } from "./stores/app-state.js";
import { AppOverlays } from "./overlays/AppOverlays.js";
import { Home } from "../features/sessions/home/components/Home.js";
import { QuickOpenContainer } from "../features/sessions/quick-open/components/QuickOpenContainer.js";
import { InboxPageContainer } from "../features/sessions/inbox/components/InboxPageContainer.js";
import { HeaderContainer } from "./components/HeaderContainer.js";
import { ComposerContainer } from "../features/chat/composer/components/ComposerContainer.js";
import { OverlayController, useOverlays } from "./overlays/OverlayController.js";
import { SessionActionsProvider } from "../features/sessions/actions/stores/SessionActionsProvider.js";
import { GlobalKeyboardController } from "./keyboard/GlobalKeyboardController.js";
import { InboxNoticeContainer } from "../features/sessions/inbox/components/InboxNoticeContainer.js";
import { RegisteredPlugins } from "./plugins/RegisteredPlugins.js";
import { workspaceLayout } from "./utils/workspace-layout.js";
import { SidePanelProvider, PluginSidePanel, useSidePanel } from "./plugins/SidePanelProvider.js";

/** Breathing room between the last message and the composer. */
const FOOTER_GAP = 24;

export function App() {
  return (
    <AppControllerProvider>
      <RegisteredPlugins>
        <ConfirmDialogProvider>
          <OverlayController>
            <SessionActionsProvider>
              <GlobalKeyboardController />
              <Workspace />
            </SessionActionsProvider>
          </OverlayController>
        </ConfirmDialogProvider>
      </RegisteredPlugins>
    </AppControllerProvider>
  );
}

function Workspace() {
  const {app} = useAppController();
  const view = app.activeSessionId && !app.viewClosed && !app.closingSessionIds.includes(app.activeSessionId) ? "transcript" : "home";
  return <SidePanelProvider view={view}><WidgetDisclosureProvider><AppContent /></WidgetDisclosureProvider></SidePanelProvider>;
}

function AppContent() {
  const chat = useAppController();
  const { app, state } = chat;
  const overlays = useOverlays();
  const [footerHeight, setFooterHeight] = useState(170);
  const home = atHome(app);
  const headerHeight = 58;
  const { width } = useViewportSize();
  const panel = useSidePanel();
  const layout = workspaceLayout(width, overlays.state.projects, panel.opened);
  const panelWidth = layout.right;
  const widgetsCanDock = layout.widgetsDocked;
  const { docked: widgetsDocked } = placeWidgets(state.widgets, widgetsCanDock);
  const workspaceLeft = typeof layout.left === "number" ? `${layout.left}px` : layout.left;

  return (
    <AppShell header={{ height: headerHeight }} padding={0} style={{
      "--pi-header-height": `${headerHeight}px`,
      "--pi-workspace-left": workspaceLeft,
      "--pi-workspace-right": `${panelWidth}px`,
      "--pi-projects-width": layout.sidebarWidth,
    } as CSSProperties}>
      <AgentationFeedback />
      <HeaderContainer />

      {home ? null : <WidgetDock widgets={widgetsDocked} />}

      <AppOverlays />

      <AppShell.Main inert={layout.panelStacked || undefined} style={layout.panelStacked ? {visibility:"hidden"} : undefined} ml={workspaceLeft} w={`calc(100% - ${workspaceLeft} - ${panelWidth}px)`} pb={home ? 0 : footerHeight + FOOTER_GAP} h={home ? `calc(100dvh - ${headerHeight}px)` : undefined}>
        <InboxNoticeContainer />
        {home ? (
          <Home search={<QuickOpenContainer inline />}>
            <InboxPageContainer />
          </Home>
        ) : (
          <MessageListContainer footerHeight={footerHeight + FOOTER_GAP} />
        )}
      </AppShell.Main>

      <div inert={layout.panelStacked || undefined} style={layout.panelStacked ? {visibility:"hidden"} : undefined}>
        <ComposerContainer onHeightChange={setFooterHeight} widgetsDocked={widgetsCanDock} />
      </div>
      <PluginSidePanel stacked={layout.panelStacked} />
    </AppShell>
  );
}
