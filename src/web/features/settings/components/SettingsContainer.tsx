import { useAppController } from "../../../app/AppControllerContext.js";
import { useOverlays } from "../../../app/overlays/OverlayController.js";
import { useChimes } from "../preferences/hooks/use-chimes.js";
import { useDisplayPath } from "../preferences/hooks/use-display-path.js";
import { useHideArchivedSessions } from "../preferences/hooks/use-hide-archived-sessions.js";
import { useTranscriptDensity } from "../preferences/hooks/use-transcript-density.js";
import { SettingsDrawer } from "./SettingsDrawer.js";
import { ServerSettingsContainer } from "../server/index.js";
import { VersionsContainer } from "../versions/components/VersionsContainer.js";

export function SettingsContainer() {
  const chat = useAppController();
  const overlays = useOverlays();
  const { app, state } = chat;
  const busy = state.status === "running" || state.status === "aborting";
  const chimes = useChimes(app.tabs);
  const displayPath = useDisplayPath();
  const archivedSessions = useHideArchivedSessions();
  const transcript = useTranscriptDensity();
  
  return (
    <SettingsDrawer
      inboxEnabled={chat.inboxEnabled}
      setInboxEnabled={chat.setInboxEnabled}
      opened={overlays.state.settings}
      onClose={() => overlays.close("settings")}
      state={state}
      busy={busy}
      serverSettings={<ServerSettingsContainer preference={chat.serverEndpoint} connected={app.connection === "open"} failed={app.connection !== "open" && !!app.error} />}
      versions={<VersionsContainer endpoint={chat.serverEndpoint.endpoint} connected={app.connection === "open"} opened={overlays.state.settings} />}
      setThinkingLevel={chat.setThinkingLevel}
      setModel={chat.setModel}
      compactSession={chat.compactSession}
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
    />
  );
}
