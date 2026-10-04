import { useAppController } from "../../app/AppControllerContext.js";
import { useDisplayPath } from "../../app/use-display-path.js";
import { useOverlays } from "../../app/overlays/OverlayController.js";
import { ProjectSessionDrawer } from "./ProjectSessionDrawer.js";

export function ProjectSessionContainer() {
  const chat = useAppController();
  const overlays = useOverlays();
  const { app, state } = chat;
  const displayPath = useDisplayPath();
  const busy = state.status === "running" || state.status === "aborting";

  return (
    <ProjectSessionDrawer
      opened={overlays.state.projects}
      onClose={() => overlays.close("projects")}
      state={state}
      catalogue={app.catalogue}
      busy={busy}
      showDisplayPath={displayPath.show}
      openSession={chat.openSession}
      newSession={chat.newSession}
      deleteSession={chat.deleteSession}
      onOpenFolder={() => overlays.open("folderPicker")}
    />
  );
}
