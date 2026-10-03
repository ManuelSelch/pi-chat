import type { Tab, UiPrompt, UiPromptResult } from "../../shared/protocol.js";
import { ConfirmModal, type Confirmation } from "../app/ConfirmModal.js";
import { PromptModal } from "../prompts/PromptModal.js";
import { CloseSessionDialog } from "./CloseSessionDialog.js";
import { RenameSessionDialog } from "./RenameSessionDialog.js";

interface DialogsProps {
  closing: Tab | undefined;
  onClosingChange: (tab: Tab | undefined) => void;
  confirming: Confirmation | undefined;
  onConfirmingChange: (confirmation: Confirmation | undefined) => void;
  renaming: string | undefined;
  onRenamingChange: (value: string | undefined) => void;
  prompt?: UiPrompt;
  onRespondToPrompt: (promptId: string, result: UiPromptResult) => void;
  closeTab: (sessionId: string) => void;
  renameSession: (name: string) => void;
}

export function Dialogs({
  closing,
  onClosingChange,
  confirming,
  onConfirmingChange,
  renaming,
  onRenamingChange,
  prompt,
  onRespondToPrompt,
  closeTab,
  renameSession,
}: DialogsProps) {
  return (
    <>
      <PromptModal prompt={prompt} onRespond={onRespondToPrompt} />
      <CloseSessionDialog
        tab={closing}
        onClose={() => onClosingChange(undefined)}
        onConfirm={closeTab}
      />
      <ConfirmModal confirmation={confirming} onClose={() => onConfirmingChange(undefined)} />
      <RenameSessionDialog value={renaming} onChange={onRenamingChange} onRename={renameSession} />
    </>
  );
}
