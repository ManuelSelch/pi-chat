import { useAppController } from "../state/AppControllerContext.js";
import { useOverlays } from "../overlays/OverlayController.js";
import { FolderPicker } from "./FolderPicker.js";

export function FolderPickerContainer() {
  const chat = useAppController();
  const overlays = useOverlays();
  const { app, state } = chat;

  return (
    <FolderPicker
      opened={overlays.state.folderPicker}
      connected={app.connection === "open"}
      initialPath={state.projectPath || undefined}
      onClose={() => overlays.close("folderPicker")}
      browseDirectories={chat.browseDirectories}
      startSession={chat.startFolderSession}
    />
  );
}
