import { InboxContainer } from "../../features/sessions/inbox/components/InboxContainer.js";
import { useAppController } from "../AppControllerContext.js";
import { PromptModal } from "../../features/extensions/prompts/components/PromptModal.js";
import { CloseSessionDialog } from "../../features/sessions/dialogs/components/CloseSessionDialog.js";
import { QuickOpenContainer } from "../../features/sessions/quick-open/components/QuickOpenContainer.js";
import { ProjectSessionContainer } from "../../features/sessions/projects/components/ProjectSessionContainer.js";
import { FolderPickerContainer } from "../../features/sessions/folders/components/FolderPickerContainer.js";
import { SettingsContainer } from "../../features/settings/components/SettingsContainer.js";
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
      {chat.inboxEnabled ? <InboxContainer /> : <ProjectSessionContainer />}
      <FolderPickerContainer />
      <SettingsContainer />
    </>
  );
}
