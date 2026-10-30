import { useAppController } from "../../../../app/AppControllerContext.js";
import { InboxNotice } from "../components/InboxNotice.js";

export function InboxNoticeContainer() {
  const chat = useAppController();
  return chat.inboxEnabled ? <InboxNotice error={chat.inbox.error} onDismiss={chat.inbox.dismissError} /> : null;
}
