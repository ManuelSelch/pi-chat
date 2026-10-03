import { useAppController } from "../state/AppControllerContext.js";
import { useDisplayPath } from "../app/use-display-path.js";
import { ProjectSessionDrawer } from "./ProjectSessionDrawer.js";

interface ProjectSessionContainerProps {
  opened: boolean;
  onClose: () => void;
  onOpenFolder: () => void;
}

export function ProjectSessionContainer({ opened, onClose, onOpenFolder }: ProjectSessionContainerProps) {
  const chat = useAppController();
  const { app, state } = chat;
  const displayPath = useDisplayPath();
  const busy = state.status === "running" || state.status === "aborting";

  return (
    <ProjectSessionDrawer
      opened={opened}
      onClose={onClose}
      state={state}
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
