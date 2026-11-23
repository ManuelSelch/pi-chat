import { useAppController } from "../../../../app/AppControllerContext.js";
import { InboxNotice } from "./InboxNotice.js";

export function InboxNoticeContainer() {
  const chat = useAppController();
  return <InboxNotice error={chat.inbox.error} onDismiss={chat.inbox.dismissError} />;
}
