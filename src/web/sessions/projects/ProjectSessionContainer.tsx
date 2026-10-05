import { useCallback } from "react";
import { useAppController } from "../../app/AppControllerContext.js";
import { useDisplayPath } from "../../settings/preferences/use-display-path.js";
import { useOverlays } from "../../app/overlays/OverlayController.js";
import { ProjectSessionDrawer } from "./ProjectSessionDrawer.js";

export function ProjectSessionContainer() {
  const chat = useAppController();
  const overlays = useOverlays();
  const { app, state } = chat;
  const displayPath = useDisplayPath();
  const busy = state.status === "running" || state.status === "aborting";
  const onClose = useCallback(() => overlays.close("projects"), [overlays.close]);
  const onOpenFolder = useCallback(() => overlays.open("folderPicker"), [overlays.open]);

  return (
    <ProjectSessionDrawer
      opened={overlays.state.projects}
      onClose={onClose}
      currentSessionId={state.sessionId}
      currentProjectPath={state.projectPath}
      catalogue={app.catalogue}
      busy={busy}
      showDisplayPath={displayPath.show}
      openSession={chat.openSession}
      newSession={chat.newSession}
      deleteSession={chat.deleteSession}
      onOpenFolder={onOpenFolder}
    />
  );
}
