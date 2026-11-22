import type { ReactNode } from "react";
import { Button, Drawer, Select, Stack, Switch } from "@mantine/core";
import { IconBrain, IconPuzzle, IconAdjustments } from "@tabler/icons-react";
import type { ThinkingLevel } from "../../../types/view-types.js";
import type { ChatState } from "../../../app/stores/chat-state.js";
import { Slot } from "../../extensions/components/Slot.js";
import { SectionHeader } from "../../../components/SectionHeader.js";
import { Panel } from "../../../components/Panel.js";
import { useComposerFocusReturn } from "../../../hooks/composer-focus.js";

interface SettingsDrawerProps {
  opened: boolean;
  onClose: () => void;
  state: ChatState;
  busy: boolean;
  serverSettings: ReactNode;
  versions: ReactNode;
  setThinkingLevel: (level: ThinkingLevel) => void;
  setModel: (model: string) => void;
  compactSession: () => void;
  agentationEnabled: boolean;
  setAgentationEnabled: (value: boolean) => void;
  inboxEnabled: boolean;
  setInboxEnabled: (value: boolean) => void;
  pluginFeatureToggles: ReactNode;
  displayPathShow: boolean;
  setDisplayPathShow: (value: boolean) => void;
  hideArchivedSessions: boolean;
  setHideArchivedSessions: (value: boolean) => void;
  transcriptDensity: "comfortable" | "compact";
  setTranscriptDensity: (value: "comfortable" | "compact") => void;
  runExtensionAction: (actionId: string) => void;
}

export function SettingsDrawer({ opened, onClose, state, busy, serverSettings, versions, setThinkingLevel, setModel, compactSession, pluginFeatureToggles, displayPathShow, setDisplayPathShow, hideArchivedSessions, setHideArchivedSessions, transcriptDensity, setTranscriptDensity, runExtensionAction, inboxEnabled, setInboxEnabled, agentationEnabled, setAgentationEnabled }: SettingsDrawerProps) {
  const focusReturn = useComposerFocusReturn(opened);
  const thinkingFeature = state.actions.features.find((feature) => feature.id === "thinking.level");
  const modelFeature = state.actions.features.find((feature) => feature.id === "model.select");
  const compactFeature = state.actions.features.find((feature) => feature.id === "session.compact");
  const hasSessionControls = Boolean(thinkingFeature) || Boolean(modelFeature) || Boolean(compactFeature);
  // Extensions place their own controls here, so the section only exists once one registered something.
  const hasExtensionControls =
    state.extensions.buttons.some((button) => button.slot === "settings.section") ||
    state.extensions.badges.some((badge) => badge.slot === "settings.section");

  return (
    <Drawer {...focusReturn} opened={opened} onClose={onClose} title="Settings" size="md" position="right">
      <Stack gap="md">
        {hasSessionControls ? (
          <Panel>
            <div role="group" aria-label="Session">
              <SectionHeader icon={<IconBrain size={16} />}>Session</SectionHeader>
              <Stack gap="sm">
                {thinkingFeature ? (
                  <Select
                    aria-label="Thinking level"
                    label={thinkingFeature.title}
                    value={thinkingFeature.state.value}
                    data={thinkingFeature.state.options}
                    disabled={busy || thinkingFeature.state.options.length <= 1}
                    onChange={(value) => { if (value) setThinkingLevel(value as ThinkingLevel); }}
                  />
                ) : null}
                {modelFeature ? (
                  <Select
                    aria-label="Model"
                    label={modelFeature.title}
                    searchable
                    value={modelFeature.state.value || null}
                    data={modelFeature.state.options}
                    disabled={busy || modelFeature.state.options.length === 0}
                    onChange={(value) => { if (value) setModel(value); }}
                  />
                ) : null}
                {compactFeature ? (
                  <Button variant="filled" disabled={busy} onClick={compactSession}>
                    {compactFeature.state.label}
                  </Button>
                ) : null}
              </Stack>
            </div>
          </Panel>
        ) : null}
        <Panel>
          <div role="group" aria-label="Feature Toggles">
            <SectionHeader icon={<IconAdjustments size={16} />}>Feature Toggles</SectionHeader>
            <Switch label="Agentation UI feedback" checked={agentationEnabled} onChange={(event) => setAgentationEnabled(event.currentTarget.checked)} />
            <Switch mt="sm" label="Show open sessions in sidebar" checked={inboxEnabled} onChange={event => setInboxEnabled(event.currentTarget.checked)} />
            {pluginFeatureToggles}
            <Switch
              mt="sm"
              checked={displayPathShow}
              onChange={(event) => setDisplayPathShow(event.currentTarget.checked)}
              label="Show folder path in projects panel"
            />
            <Switch
              mt="sm"
              checked={hideArchivedSessions}
              onChange={(event) => setHideArchivedSessions(event.currentTarget.checked)}
              label="Hide archived sessions"
              aria-label="Hide archived sessions"
            />
            <Switch
              mt="sm"
              checked={transcriptDensity === "compact"}
              onChange={(event) => setTranscriptDensity(event.currentTarget.checked ? "compact" : "comfortable")}
              label="Compact transcript"
            />
          </div>
        </Panel>

        {hasExtensionControls ? (
          <Panel>
            <SectionHeader icon={<IconPuzzle size={16} />}>Extensions</SectionHeader>
            <Slot
              name="settings.section"
              buttons={state.extensions.buttons}
              badges={state.extensions.badges}
              onAction={runExtensionAction}
            />
          </Panel>
        ) : null}

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
