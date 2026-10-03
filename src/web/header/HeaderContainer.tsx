import { atHome, visibleTabs } from "../chat/app-state.js";
import { useAppController } from "../state/AppControllerContext.js";
import type { Tab } from "../../shared/protocol.js";
import { HeaderView } from "./HeaderView.js";

interface HeaderContainerProps {
  onOpenProjects: () => void;
  onOpenSettings: () => void;
  onRequestCloseRunning: (tab: Tab) => void;
}

export function HeaderContainer({ onOpenProjects, onOpenSettings, onRequestCloseRunning }: HeaderContainerProps) {
  const chat = useAppController();
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
      onOpenProjects={onOpenProjects}
      onOpenSettings={onOpenSettings}
      onAction={chat.runExtensionAction}
      onFocusTab={chat.focusTab}
      onCloseTab={(tab) => (tab.status === "idle" ? chat.closeTab(tab.sessionId) : onRequestCloseRunning(tab))}
      onNewSession={() => chat.newSession(state.projectPath || undefined)}
    />
  );
}
