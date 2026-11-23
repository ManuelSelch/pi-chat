import type { ReactNode } from "react";
import { Drawer, Stack, Switch } from "@mantine/core";
import { IconAdjustments } from "@tabler/icons-react";
import { SectionHeader } from "../../../components/SectionHeader.js";
import { Panel } from "../../../components/Panel.js";
import { useComposerFocusReturn } from "../../../hooks/composer-focus.js";

interface SettingsDrawerProps {
  opened: boolean;
  onClose: () => void;
  serverSettings: ReactNode;
  versions: ReactNode;
  agentationEnabled: boolean;
  setAgentationEnabled: (value: boolean) => void;
  pluginFeatureToggles: ReactNode;
  transcriptDensity: "comfortable" | "compact";
  setTranscriptDensity: (value: "comfortable" | "compact") => void;
}

export function SettingsDrawer({ opened, onClose, serverSettings, versions, pluginFeatureToggles, transcriptDensity, setTranscriptDensity, agentationEnabled, setAgentationEnabled }: SettingsDrawerProps) {
  const focusReturn = useComposerFocusReturn(opened);

  return (
    <Drawer {...focusReturn} opened={opened} onClose={onClose} title="Settings" size="md" position="right">
      <Stack gap="md">
        <Panel>
          <div role="group" aria-label="Feature Toggles">
            <SectionHeader icon={<IconAdjustments size={16} />}>Feature Toggles</SectionHeader>
            <Switch label="Agentation UI feedback" checked={agentationEnabled} onChange={(event) => setAgentationEnabled(event.currentTarget.checked)} />
            {pluginFeatureToggles}
            <Switch
              mt="sm"
              checked={transcriptDensity === "compact"}
              onChange={(event) => setTranscriptDensity(event.currentTarget.checked ? "compact" : "comfortable")}
              label="Compact transcript"
            />
          </div>
        </Panel>

        <Panel>
          <div role="group" aria-label="Backend server">
            <Stack gap="sm">
              {serverSettings}
            </Stack>
          </div>
        </Panel>
        {versions}
      </Stack>
    </Drawer>
  );
}
