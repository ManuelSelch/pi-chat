import { useAppController } from "../AppControllerContext.js";
import { PromptModal } from "../../extensions/prompts/PromptModal.js";
import { CloseSessionDialog } from "../../sessions/dialogs/CloseSessionDialog.js";
import { RenameSessionDialog } from "../../sessions/dialogs/RenameSessionDialog.js";
import { QuickOpenContainer } from "../../sessions/quick-open/QuickOpenContainer.js";
import { ProjectSessionContainer } from "../../sessions/projects/ProjectSessionContainer.js";
import { FolderPickerContainer } from "../../sessions/folders/FolderPickerContainer.js";
import { SettingsContainer } from "../../settings/SettingsContainer.js";
import { useOverlays } from "./OverlayController.js";

/** App-level assembly only; each feature retains its own overlay behavior. */
export function AppOverlays() {
  const chat = useAppController();
  const overlays = useOverlays();
  return (
    <>
      <PromptModal prompt={chat.state.prompts.at(-1)} onRespond={chat.respondToPrompt} />
      <CloseSessionDialog
        tab={overlays.state.closingTab}
        onClose={() => overlays.close("closingTab")}
        onConfirm={chat.closeTab}
      />
      <RenameSessionDialog
        value={overlays.state.renamingSession}
        onChange={(value) => value === undefined ? overlays.close("renamingSession") : overlays.requestRename(value)}
        onRename={chat.renameSession}
      />
      <QuickOpenContainer />
      <ProjectSessionContainer />
      <FolderPickerContainer />
      <SettingsContainer />
    </>
  );
}
