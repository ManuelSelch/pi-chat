import { atHome, visibleTabs } from "../stores/app-state.js";
import { useAppController } from "../AppControllerContext.js";
import { useOverlays } from "../overlays/OverlayController.js";
import { focusComposer } from "../../hooks/composer-focus.js";
import { hasSavedSession } from "../../features/sessions/inbox/utils/inbox-model.js";
import { InboxHeader } from "../../features/sessions/inbox/components/InboxHeader.js";

export function HeaderContainer() {
  const chat = useAppController();
  const overlays = useOverlays();
  const { app } = chat;
  const selected = visibleTabs(app).find(tab => tab.sessionId === app.activeSessionId);
  const project = app.catalogue.projects.find(project => project.path === selected?.projectPath);
  const headerSession = selected && project ? { ...selected, projectName: project.quickChats ? "Quick Chat" : project.repositoryName ?? selected.projectName } : selected;
  return <InboxHeader session={headerSession} title={selected?.title ?? (atHome(app) ? "Home" : undefined)}
    branch={project?.worktree?.primary === false ? project.worktree.branch : undefined}
    opened={overlays.state.projects} disabled={app.connection !== "open"} pending={chat.inbox.pending} saved={hasSavedSession(app.catalogue, selected?.sessionPath)}
    onToggle={() => { overlays.toggle("projects"); if (overlays.projectsPresentation === "sidebar") focusComposer(); }}
    onNew={() => chat.newSession(selected?.projectPath)}
    onPark={() => { if (selected) void chat.inbox.park(selected.sessionId); }}
    onArchive={() => { if (selected?.sessionPath) void chat.inbox.archive(selected.sessionPath); }}
    onCloseView={chat.closeView} />;
}
