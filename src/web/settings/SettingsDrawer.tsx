import type { ReactNode } from "react";
import { Button, Drawer, Select, Stack, Switch } from "@mantine/core";
import { MANTINE_COLOR } from "../ui/theme.js";
import { IconBrain, IconPuzzle, IconAdjustments } from "@tabler/icons-react";
import type { ThinkingLevel, WebFeature } from "../app/state/view-types.js";
import type { ChatState } from "../app/state/chat-state.js";
import { Slot } from "../extensions/Slot.js";
import { SectionHeader } from "../ui/SectionHeader.js";
import { Panel } from "../ui/Panel.js";
import { useComposerFocusReturn } from "../ui/focus/composer-focus.js";

interface SettingsDrawerProps {
  opened: boolean;
  onClose: () => void;
  state: ChatState;
  busy: boolean;
  serverSettings: ReactNode;
  setThinkingLevel: (level: ThinkingLevel) => void;
  setModel: (model: string) => void;
  compactSession: () => void;
  restartServer: () => void;
  appFeatures: readonly WebFeature[];
  inboxEnabled: boolean;
  setInboxEnabled: (value: boolean) => void;
  chimesEnabled: boolean;
  setChimesEnabled: (value: boolean) => void;
  chimesAvailable: boolean;
  displayPathShow: boolean;
  setDisplayPathShow: (value: boolean) => void;
  hideArchivedSessions: boolean;
  setHideArchivedSessions: (value: boolean) => void;
  transcriptDensity: "comfortable" | "compact";
  setTranscriptDensity: (value: "comfortable" | "compact") => void;
  runExtensionAction: (actionId: string) => void;
}

export function SettingsDrawer({ opened, onClose, state, busy, serverSettings, setThinkingLevel, setModel, compactSession, restartServer, appFeatures, chimesEnabled, setChimesEnabled, chimesAvailable, displayPathShow, setDisplayPathShow, hideArchivedSessions, setHideArchivedSessions, transcriptDensity, setTranscriptDensity, runExtensionAction, inboxEnabled, setInboxEnabled }: SettingsDrawerProps) {
  const focusReturn = useComposerFocusReturn(opened);
  const thinkingFeature = state.actions.features.find((feature) => feature.id === "thinking.level");
  const modelFeature = state.actions.features.find((feature) => feature.id === "model.select");
  const compactFeature = state.actions.features.find((feature) => feature.id === "session.compact");
  // At home there is no session snapshot, so app-level features arrive separately.
  const restartFeature = [...state.actions.features, ...appFeatures].find((feature) => feature.id === "app.restart");
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
            <Switch label="Show open sessions in sidebar" checked={inboxEnabled} onChange={event => setInboxEnabled(event.currentTarget.checked)} />
            <Switch
              mt="sm"
              checked={chimesEnabled}
              onChange={(event) => setChimesEnabled(event.currentTarget.checked)}
              disabled={!chimesAvailable}
              label="Chime when a run finishes or needs an answer"
            />
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
              {restartFeature ? (
                <Button variant="light" color={MANTINE_COLOR.danger} onClick={restartServer}>
                  {restartFeature.state.label}
                </Button>
              ) : null}
            </Stack>
          </div>
        </Panel>
      </Stack>
    </Drawer>
  );
}
