import type { UiPrompt, UiPromptResult } from "../../shared/protocol.js";
import { PromptModal } from "../extensions/prompts/PromptModal.js";
import { useOverlays } from "../app/overlays/OverlayController.js";
import { CloseSessionDialog } from "../sessions/dialogs/CloseSessionDialog.js";
import { RenameSessionDialog } from "../sessions/dialogs/RenameSessionDialog.js";

interface DialogsProps {
  prompt?: UiPrompt;
  onRespondToPrompt: (promptId: string, result: UiPromptResult) => void;
  closeTab: (sessionId: string) => void;
  renameSession: (name: string) => void;
}

export function Dialogs({
  prompt,
  onRespondToPrompt,
  closeTab,
  renameSession,
}: DialogsProps) {
  const overlays = useOverlays();
  return (
    <>
      <PromptModal prompt={prompt} onRespond={onRespondToPrompt} />
      <CloseSessionDialog
        tab={overlays.state.closingTab}
        onClose={() => overlays.close("closingTab")}
        onConfirm={closeTab}
      />
      <RenameSessionDialog
        value={overlays.state.renamingSession}
        onChange={(value) => value === undefined ? overlays.close("renamingSession") : overlays.requestRename(value)}
        onRename={renameSession}
      />
    </>
  );
}
