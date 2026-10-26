import { useCallback } from "react";
import { useAppController } from "../app/AppControllerContext.js";
import { useOverlays } from "../app/overlays/OverlayController.js";
import { useConfirmDialog } from "../ui/confirm/ConfirmDialogProvider.js";
import { useChimes } from "./preferences/use-chimes.js";
import { useDisplayPath } from "./preferences/use-display-path.js";
import { useHideArchivedSessions } from "./preferences/use-hide-archived-sessions.js";
import { useTranscriptDensity } from "./preferences/use-transcript-density.js";
import { SettingsDrawer } from "./SettingsDrawer.js";
import { ServerSettingsContainer } from "./server/index.js";

export function SettingsContainer() {
  const chat = useAppController();
  const { confirm } = useConfirmDialog();
  const overlays = useOverlays();
  const { app, state } = chat;
  const busy = state.status === "running" || state.status === "aborting";
  const chimes = useChimes(app.tabs);
  const displayPath = useDisplayPath();
  const archivedSessions = useHideArchivedSessions();
  const transcript = useTranscriptDensity();
  
  const restartServer = useCallback(async () => {
    if (await confirm({
      title: "Restart server?",
      body: "The client is rebuilt and the server restarts. Open sessions close and the page reconnects on its own.",
      confirmLabel: "Restart",
    })) await chat.restartServer();
  }, [chat, confirm]);

  return (
    <SettingsDrawer
      opened={overlays.state.settings}
      onClose={() => overlays.close("settings")}
      state={state}
      busy={busy}
      serverSettings={<ServerSettingsContainer preference={chat.serverEndpoint} connected={app.connection === "open"} failed={app.connection !== "open" && !!app.error} />}
      setThinkingLevel={chat.setThinkingLevel}
      setModel={chat.setModel}
      compactSession={chat.compactSession}
      appFeatures={app.appFeatures}
      chimesEnabled={chimes.enabled}
      setChimesEnabled={chimes.setEnabled}
      chimesAvailable={chimes.available}
      displayPathShow={displayPath.show}
      setDisplayPathShow={displayPath.setShow}
      hideArchivedSessions={archivedSessions.hide}
      setHideArchivedSessions={archivedSessions.setHide}
      transcriptDensity={transcript.density}
      setTranscriptDensity={transcript.setDensity}
      runExtensionAction={chat.runExtensionAction}
      restartServer={restartServer}
    />
  );
}
