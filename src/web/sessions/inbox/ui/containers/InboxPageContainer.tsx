import { useState } from "react";
import { useAppController } from "../../../../app/AppControllerContext.js";
import { useInboxRows } from "../../app/use-inbox-rows.js";
import { InboxPage } from "../components/InboxPage.js";

export function InboxPageContainer() {
  const chat = useAppController();
  const rows = useInboxRows(chat.app, chat.inbox.later);
  const [laterOpen, setLaterOpen] = useState(false);
  return <InboxPage rows={rows} later={chat.inbox.later} pending={chat.inbox.pending || chat.app.connection !== "open"} error={chat.inbox.error}
    laterOpen={laterOpen} onLaterToggle={() => setLaterOpen(value => !value)}
    onOpen={(row, later) => {
      if (later && row.path) void chat.inbox.resume(row.path);
      else if (row.sessionId) chat.focusTab(row.sessionId);
      else if (row.path) void chat.inbox.select(row.path);
    }}
    onPark={row => { const target = row.sessionId ?? row.path; if (target) void chat.inbox.park(target); }}
    onArchive={row => { if (row.path) void chat.inbox.archive(row.path); }}
    onNew={() => chat.navigateWorkspace("home")} />;
}
