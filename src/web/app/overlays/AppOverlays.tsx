import { useAppController } from "../AppControllerContext.js";
import { PromptModal } from "../../extensions/prompts/PromptModal.js";
import { CloseSessionDialog } from "../../sessions/dialogs/CloseSessionDialog.js";
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
      <PromptModal key={JSON.stringify([chat.app.serverInstanceId, chat.app.activeSessionId])} prompt={chat.promptPresentation.prompt} draft={chat.promptPresentation.draft}
        onDraftChange={chat.promptPresentation.update} minimized={chat.promptPresentation.minimized}
        onMinimize={chat.promptPresentation.minimize} disabled={chat.promptPresentation.disabled}
        onRespond={chat.promptPresentation.respond} />
      <CloseSessionDialog
        tab={overlays.state.closingTab}
        onClose={() => overlays.close("closingTab")}
        onConfirm={chat.closeTab}
      />
      <QuickOpenContainer />
      <ProjectSessionContainer />
      <FolderPickerContainer />
      <SettingsContainer />
    </>
  );
}
