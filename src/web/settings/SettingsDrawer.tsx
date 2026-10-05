import { Button, Drawer, Select, Stack, Switch, Text } from "@mantine/core";
import { MANTINE_COLOR } from "../ui/theme.js";
import { IconArchive, IconBell, IconBrain, IconCpu, IconFolder, IconPuzzle, IconRefresh } from "@tabler/icons-react";
import type { ThinkingLevel, WebFeature } from "../../shared/protocol.js";
import type { ChatState } from "../app/state/chat-state.js";
import { Slot } from "../extensions/Slot.js";
import { SectionHeader } from "../ui/SectionHeader.js";
import { Panel } from "../ui/Panel.js";

interface SettingsDrawerProps {
  opened: boolean;
  onClose: () => void;
  state: ChatState;
  busy: boolean;
  setThinkingLevel: (level: ThinkingLevel) => void;
  setModel: (model: string) => void;
  compactSession: () => void;
  restartServer: () => void;
  appFeatures: WebFeature[];
  chimesEnabled: boolean;
  setChimesEnabled: (value: boolean) => void;
  chimesAvailable: boolean;
  displayPathShow: boolean;
  setDisplayPathShow: (value: boolean) => void;
  runExtensionAction: (actionId: string) => void;
}

export function SettingsDrawer({ opened, onClose, state, busy, setThinkingLevel, setModel, compactSession, restartServer, appFeatures, chimesEnabled, setChimesEnabled, chimesAvailable, displayPathShow, setDisplayPathShow, runExtensionAction }: SettingsDrawerProps) {
  const thinkingFeature = state.actions.features.find((feature) => feature.id === "thinking.level");
  const modelFeature = state.actions.features.find((feature) => feature.id === "model.select");
  const compactFeature = state.actions.features.find((feature) => feature.id === "session.compact");
  // At home there is no session snapshot, so app-level features arrive separately.
  const restartFeature = [...state.actions.features, ...appFeatures].find((feature) => feature.id === "app.restart");
  // Extensions place their own controls here, so the section only exists once one registered something.
  const hasExtensionControls =
    state.extensions.buttons.some((button) => button.slot === "settings.section") ||
    state.extensions.badges.some((badge) => badge.slot === "settings.section");

  return (
    <Drawer opened={opened} onClose={onClose} title="Settings" size="md" position="right">
      <Stack gap="md">
        <Panel>
          <SectionHeader icon={<IconBell size={16} />}>Sounds</SectionHeader>
          <Switch
            checked={chimesEnabled}
            onChange={(event) => setChimesEnabled(event.currentTarget.checked)}
            disabled={!chimesAvailable}
            label="Chime when a run finishes or needs an answer"
          />
        </Panel>
        <Panel>
          <SectionHeader icon={<IconFolder size={16} />}>Projects</SectionHeader>
          <Switch
            checked={displayPathShow}
            onChange={(event) => setDisplayPathShow(event.currentTarget.checked)}
            label="Show folder path in projects panel"
          />
        </Panel>
        {thinkingFeature ? (
          <Panel>
            <SectionHeader icon={<IconBrain size={16} />}>{thinkingFeature.title}</SectionHeader>
            <Select
              aria-label="Thinking level"
              value={thinkingFeature.state.value}
              data={thinkingFeature.state.options}
              disabled={busy || thinkingFeature.state.options.length <= 1}
              onChange={(value) => { if (value) setThinkingLevel(value as ThinkingLevel); }}
            />
          </Panel>
        ) : null}
        {modelFeature ? (
          <Panel>
            <SectionHeader icon={<IconCpu size={16} />}>{modelFeature.title}</SectionHeader>
            <Select
              aria-label="Model"
              searchable
              value={modelFeature.state.value || null}
              data={modelFeature.state.options}
              disabled={busy || modelFeature.state.options.length === 0}
              onChange={(value) => { if (value) setModel(value); }}
            />
          </Panel>
        ) : null}
        {compactFeature ? (
          <Panel>
            <SectionHeader icon={<IconArchive size={16} />}>{compactFeature.title}</SectionHeader>
            {compactFeature.description ? (
              <Text size="xs" c="dimmed" mb="xs">{compactFeature.description}</Text>
            ) : null}
            <Button variant="filled" disabled={busy} onClick={compactSession}>
              {compactFeature.state.label}
            </Button>
          </Panel>
        ) : null}

        {restartFeature ? (
          <Panel>
            <SectionHeader icon={<IconRefresh size={16} />}>{restartFeature.title}</SectionHeader>
            {restartFeature.description ? (
              <Text size="xs" c="dimmed" mb="xs">{restartFeature.description}</Text>
            ) : null}
            <Button variant="light" color={MANTINE_COLOR.danger} onClick={restartServer}>
              {restartFeature.state.label}
            </Button>
          </Panel>
        ) : null}

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
      </Stack>
    </Drawer>
  );
}
