import { useState } from "react";
import { ActionIcon, Button, Drawer, Group, Paper, Select, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { IconArchive, IconBrain, IconCpu, IconDeviceFloppy, IconPencil, IconRefresh } from "@tabler/icons-react";
import type { ThinkingLevel, WebFeature } from "../../shared/protocol.js";
import type { ChatState } from "../chat/chat-state.js";

interface SettingsDrawerProps {
  opened: boolean;
  onClose: () => void;
  state: ChatState;
  busy: boolean;
  renameSession: (name: string) => void;
  setThinkingLevel: (level: ThinkingLevel) => void;
  setModel: (model: string) => void;
  compactSession: () => void;
  restartServer: () => void;
  appFeatures: WebFeature[];
}

export function SettingsDrawer({ opened, onClose, state, busy, renameSession, setThinkingLevel, setModel, compactSession, restartServer, appFeatures }: SettingsDrawerProps) {
  const [sessionNameInput, setSessionNameInput] = useState<string | undefined>();
  const renameFeature = state.actions.features.find((feature) => feature.id === "session.rename");
  const thinkingFeature = state.actions.features.find((feature) => feature.id === "thinking.level");
  const modelFeature = state.actions.features.find((feature) => feature.id === "model.select");
  const compactFeature = state.actions.features.find((feature) => feature.id === "session.compact");
  // At home there is no session snapshot, so app-level features arrive separately.
  const restartFeature = [...state.actions.features, ...appFeatures].find((feature) => feature.id === "app.restart");
  const currentName = renameFeature?.state.name ?? "";
  const sessionName = sessionNameInput ?? currentName;
  // Renaming to the name it already has is a no-op, so the control stays inert
  // until the field actually differs.
  const nameChanged = sessionName.trim().length > 0 && sessionName.trim() !== currentName.trim();

  return (
    <Drawer opened={opened} onClose={onClose} title="Settings" size="md" position="right">
      <Stack gap="md">
        {renameFeature ? (
          <Paper withBorder radius="md" p="sm">
            <Group gap={6} mb={6}>
              <IconPencil size={16} />
              <Text fw={650} size="sm">{renameFeature.title}</Text>
            </Group>
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <TextInput
                aria-label="Session name"
                placeholder="Session name"
                value={sessionName}
                onChange={(event) => setSessionNameInput(event.currentTarget.value)}
                flex={1}
              />
              <Tooltip label="Save session name">
                <ActionIcon
                  size="lg"
                  variant={nameChanged ? "filled" : "default"}
                  color={nameChanged ? undefined : "gray"}
                  aria-label="Save session name"
                  disabled={busy || !nameChanged}
                  onClick={() => { renameSession(sessionName.trim()); setSessionNameInput(undefined); }}
                >
                  <IconDeviceFloppy size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Paper>
        ) : null}
        {thinkingFeature ? (
          <Paper withBorder radius="md" p="sm">
            <Group gap={6} mb={6}>
              <IconBrain size={16} />
              <Text fw={650} size="sm">{thinkingFeature.title}</Text>
            </Group>
            <Select
              aria-label="Thinking level"
              value={thinkingFeature.state.value}
              data={thinkingFeature.state.options}
              disabled={busy || thinkingFeature.state.options.length <= 1}
              onChange={(value) => { if (value) setThinkingLevel(value as ThinkingLevel); }}
            />
          </Paper>
        ) : null}
        {modelFeature ? (
          <Paper withBorder radius="md" p="sm">
            <Group gap={6} mb={6}>
              <IconCpu size={16} />
              <Text fw={650} size="sm">{modelFeature.title}</Text>
            </Group>
            <Select
              aria-label="Model"
              searchable
              value={modelFeature.state.value || null}
              data={modelFeature.state.options}
              disabled={busy || modelFeature.state.options.length === 0}
              onChange={(value) => { if (value) setModel(value); }}
            />
          </Paper>
        ) : null}
        {compactFeature ? (
          <Paper withBorder radius="md" p="sm">
            <Group gap={6} mb={6}>
              <IconArchive size={16} />
              <Text fw={650} size="sm">{compactFeature.title}</Text>
            </Group>
            {compactFeature.description ? (
              <Text size="xs" c="dimmed" mb="xs">{compactFeature.description}</Text>
            ) : null}
            <Button variant="light" disabled={busy} onClick={compactSession}>
              {compactFeature.state.label}
            </Button>
          </Paper>
        ) : null}

        {restartFeature ? (
          <Paper withBorder radius="md" p="sm">
            <Group gap={6} mb={6}>
              <IconRefresh size={16} />
              <Text fw={650} size="sm">{restartFeature.title}</Text>
            </Group>
            {restartFeature.description ? (
              <Text size="xs" c="dimmed" mb="xs">{restartFeature.description}</Text>
            ) : null}
            <Button variant="light" color="red" onClick={restartServer}>
              {restartFeature.state.label}
            </Button>
          </Paper>
        ) : null}
      </Stack>
    </Drawer>
  );
}
