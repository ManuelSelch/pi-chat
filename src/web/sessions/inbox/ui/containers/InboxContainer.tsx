import { useEffect, useMemo, useRef, useState } from "react";
import { useAppController } from "../../../../app/AppControllerContext.js";
import { useOverlays } from "../../../../app/overlays/OverlayController.js";
import { visibleTabs } from "../../../../app/state/app-state.js";
import { inboxRows, matchingRows } from "../../domain/inbox-model.js";
import { InboxView } from "../components/InboxView.js";

export function InboxContainer() {
  const chat = useAppController();
  const overlays = useOverlays();
  const [query, setQuery] = useState("");
  const [workingOpen, setWorkingOpen] = useState(true);
  const [laterOpen, setLaterOpen] = useState(false);
  const rows = useMemo(() => inboxRows(visibleTabs(chat.app), chat.app.catalogue), [chat.app.tabs, chat.app.closingSessionIds, chat.app.catalogue]);
  // Mounting happens only on enabling Inbox, including a remembered preference.
  const open = useRef(overlays.open);
  useEffect(() => { open.current("projects"); }, []);
  return <InboxView opened={overlays.state.projects} presentation={overlays.projectsPresentation}
    activeSessionId={chat.app.activeSessionId} pending={chat.inbox.pending || chat.app.connection !== "open"}
    rows={matchingRows(rows, query)} later={matchingRows(chat.inbox.later, query)}
    error={chat.inbox.error} query={query} onQuery={setQuery}
    workingOpen={workingOpen} onWorkingToggle={() => setWorkingOpen(value => !value)}
    laterOpen={laterOpen} onLaterToggle={() => setLaterOpen(value => !value)}
    onClose={() => overlays.close("projects")}
    onSettings={() => { if (overlays.projectsPresentation === "drawer") overlays.close("projects"); overlays.open("settings"); }}
    onSelect={chat.focusTab} onPark={id => void chat.inbox.park(id)} onResume={path => void chat.inbox.resume(path)}
    onArchive={path => void chat.inbox.archive(path)} />;
}
