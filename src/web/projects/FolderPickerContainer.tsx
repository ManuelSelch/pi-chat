import { useAppController } from "../state/AppControllerContext.js";
import { FolderPicker } from "./FolderPicker.js";

interface FolderPickerContainerProps {
  opened: boolean;
  onClose: () => void;
}

export function FolderPickerContainer({ opened, onClose }: FolderPickerContainerProps) {
  const chat = useAppController();
  const { app, state } = chat;

  return (
    <FolderPicker
      opened={opened}
      connected={app.connection === "open"}
      initialPath={state.projectPath || undefined}
      onClose={onClose}
      browseDirectories={chat.browseDirectories}
      startSession={chat.startFolderSession}
    />
  );
}
