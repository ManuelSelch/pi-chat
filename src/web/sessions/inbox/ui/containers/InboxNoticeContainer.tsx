import { useAppController } from "../../../../app/AppControllerContext.js";
import { InboxNotice } from "../components/InboxNotice.js";

export function InboxNoticeContainer() {
  const chat = useAppController();
  return chat.inboxEnabled ? <InboxNotice error={chat.inbox.error} canUndo={chat.inbox.canUndo} pending={chat.inbox.pending}
    onDismiss={chat.inbox.dismissError} onUndo={() => void chat.inbox.undo()} /> : null;
}
