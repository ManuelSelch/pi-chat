import { atHome, visibleTabs } from "../chat/app-state.js";
import { useAppController } from "../state/AppControllerContext.js";
import { useOverlays } from "../overlays/OverlayController.js";
import { HeaderView } from "./HeaderView.js";

export function HeaderContainer() {
  const chat = useAppController();
  const overlays = useOverlays();
  const { app, state } = chat;
  const home = atHome(app);
  const sessionName = state.actions.features.find((feature) => feature.id === "session.rename")?.state.name?.trim();
  const title = home ? "No session open" : state.projectPath ? sessionName || "New session" : "Connecting…";

  return (
    <HeaderView
      home={home}
      title={title}
      status={state.status}
      tabs={visibleTabs(app)}
      openingTabs={app.openingTabs}
      activeSessionId={app.activeSessionId}
      buttons={state.extensions.buttons}
      badges={state.extensions.badges}
      onOpenProjects={() => overlays.open("projects")}
      onOpenSettings={() => overlays.open("settings")}
      onAction={chat.runExtensionAction}
      onFocusTab={chat.focusTab}
      onCloseTab={(tab) => (tab.status === "idle" ? chat.closeTab(tab.sessionId) : overlays.requestCloseTab(tab))}
      onNewSession={() => chat.newSession(state.projectPath || undefined)}
    />
  );
}
