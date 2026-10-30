import { atHome, visibleTabs } from "../state/app-state.js";
import { useAppController } from "../AppControllerContext.js";
import { useOverlays } from "../overlays/OverlayController.js";
import { focusComposer } from "../../ui/focus/composer-focus.js";
import { hasSavedSession } from "../../sessions/inbox/domain/inbox-model.js";
import { InboxHeader } from "../../sessions/inbox/ui/components/InboxHeader.js";
import { HeaderView } from "./HeaderView.js";

export function HeaderContainer() {
  const chat = useAppController();
  const overlays = useOverlays();
  const { app, state } = chat;
  const home = atHome(app);
  const sessionName = state.sessionName?.trim();
  const title = state.projectPath ? sessionName || "New session" : "Connecting…";

  if (chat.inboxEnabled) {
    const selected = visibleTabs(app).find(tab => tab.sessionId === app.activeSessionId);
    const branch = app.catalogue.projects.find(project => project.path === selected?.projectPath)?.worktree?.branch;
    return <InboxHeader session={selected} title={selected?.title} branch={branch}
      opened={overlays.state.projects} disabled={app.connection !== "open"} pending={chat.inbox.pending} saved={hasSavedSession(app.catalogue, selected?.sessionPath)}
      buttons={state.extensions.buttons} badges={state.extensions.badges} onAction={chat.runExtensionAction}
      onToggle={() => { overlays.toggle("projects"); if (overlays.projectsPresentation === "sidebar") focusComposer(); }}
      onNew={() => chat.newSession(selected?.projectPath)}
      onPark={() => { if (selected) void chat.inbox.park(selected.sessionId); }}
      onArchive={() => { if (selected?.sessionPath) void chat.inbox.archive(selected.sessionPath); }}
      onCloseView={chat.closeView} />;
  }

  return (
    <HeaderView
      home={home}
      title={title}
      tabs={visibleTabs(app)}
      openingTabs={app.openingTabs}
      activeSessionId={app.activeSessionId}
      buttons={state.extensions.buttons}
      badges={state.extensions.badges}
      projectsOpened={overlays.state.projects}
      onOpenProjects={() => {
        overlays.toggle("projects");
        if (overlays.projectsPresentation === "sidebar") focusComposer();
      }}
      onOpenSettings={() => overlays.open("settings")}
      onAction={chat.runExtensionAction}
      onFocusTab={chat.focusTab}
      onCloseTab={(tab) => (tab.status === "idle" ? chat.closeTab(tab.sessionId) : overlays.requestCloseTab(tab))}
      onNewSession={() => chat.newSession(state.projectPath || undefined)}
    />
  );
}
