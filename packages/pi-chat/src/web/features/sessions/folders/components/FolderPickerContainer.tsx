import { useAppController } from "../../../../app/AppControllerContext.js";
import { useOverlays } from "../../../../app/overlays/OverlayController.js";
import { FolderPicker } from "@manuelselch/pi-plugin-folder-opening/web";

import { useComposerFocusReturn } from "../../../../hooks/composer-focus.js";

export function FolderPickerContainer() {
  const chat = useAppController();
  const overlays = useOverlays();
  const { app, state } = chat;
  const focusReturn = useComposerFocusReturn(overlays.state.folderPicker);

  return (
    <FolderPicker
      {...focusReturn}
      opened={overlays.state.folderPicker}
      connected={app.connection === "open"}
      initialPath={state.projectPath || undefined}
      onClose={() => overlays.close("folderPicker")}
      browseDirectories={chat.browseDirectories}
      startSession={chat.startFolderSession}
    />
  );
}
