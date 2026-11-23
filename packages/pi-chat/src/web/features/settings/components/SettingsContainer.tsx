import { useAppController } from "../../../app/AppControllerContext.js";
import { useOverlays } from "../../../app/overlays/OverlayController.js";
import { useAgentation } from "../preferences/hooks/use-agentation.js";
import { PluginUIOutlet } from "../../../app/plugins/PluginProvider.js";
import { useTranscriptDensity } from "../preferences/hooks/use-transcript-density.js";
import { SettingsDrawer } from "./SettingsDrawer.js";
import { ServerSettingsContainer } from "../server/index.js";
import { VersionsContainer } from "../versions/components/VersionsContainer.js";

export function SettingsContainer() {
  const chat = useAppController();
  const overlays = useOverlays();
  const { app, state } = chat;
  const busy = state.status === "running" || state.status === "aborting";
  const agentation = useAgentation();
  const transcript = useTranscriptDensity();
  
  return (
    <SettingsDrawer
      agentationEnabled={agentation.enabled}
      setAgentationEnabled={agentation.setEnabled}
      opened={overlays.state.settings}
      onClose={() => overlays.close("settings")}
      state={state}
      busy={busy}
      serverSettings={<ServerSettingsContainer preference={chat.serverEndpoint} connected={app.connection === "open"} failed={app.connection !== "open" && !!app.error} />}
      versions={<VersionsContainer endpoint={chat.serverEndpoint.endpoint} connected={app.connection === "open"} opened={overlays.state.settings} />}
      setThinkingLevel={chat.setThinkingLevel}
      setModel={chat.setModel}
      compactSession={chat.compactSession}
      pluginFeatureToggles={<PluginUIOutlet placement="settings.feature-toggles" />}
      transcriptDensity={transcript.density}
      setTranscriptDensity={transcript.setDensity}
    />
  );
}
