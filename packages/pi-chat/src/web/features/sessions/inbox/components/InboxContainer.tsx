import { useEffect, useRef, useState } from "react";
import { useAppController } from "../../../../app/AppControllerContext.js";
import { useOverlays } from "../../../../app/overlays/OverlayController.js";
import { useInboxRows } from "../hooks/use-inbox-rows.js";
import { InboxView } from "./InboxView.js";

export function InboxContainer() {
  const chat = useAppController();
  const overlays = useOverlays();
  const [laterOpen, setLaterOpen] = useState(false);
  const rows = useInboxRows(chat.app, chat.inbox.later, chat.inbox.archivingPaths);
  // Mounting happens only on enabling Inbox, including a remembered preference.
  const open = useRef(overlays.open);
  useEffect(() => { open.current("projects"); }, []);
  return <InboxView opened={overlays.state.projects} presentation={overlays.projectsPresentation}
    activeSessionId={chat.app.activeSessionId} pending={chat.inbox.pending || chat.app.connection !== "open"}
    rows={rows} later={chat.inbox.later}
    error={chat.inbox.error}
    laterOpen={laterOpen} onLaterToggle={() => setLaterOpen(value => !value)}
    onClose={() => overlays.close("projects")}
    onSettings={() => { if (overlays.projectsPresentation === "drawer") overlays.close("projects"); overlays.open("settings"); }}
    onSelect={chat.focusTab} onOpenSaved={path => void chat.inbox.select(path)} onPark={id => void chat.inbox.park(id)} onResume={path => void chat.inbox.resume(path)}
    onArchive={path => void chat.inbox.archive(path)} />;
}
