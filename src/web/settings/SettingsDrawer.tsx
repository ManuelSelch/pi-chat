import { useState } from "react";
import { ActionIcon, Drawer, Group, Paper, Select, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { IconBrain, IconDeviceFloppy, IconPencil } from "@tabler/icons-react";
import type { ThinkingLevel } from "../../shared/protocol.js";
import type { ChatState } from "../chat/chat-state.js";

interface SettingsDrawerProps {
  opened: boolean;
  onClose: () => void;
  state: ChatState;
  busy: boolean;
  renameSession: (name: string) => void;
  setThinkingLevel: (level: ThinkingLevel) => void;
}

export function SettingsDrawer({ opened, onClose, state, busy, renameSession, setThinkingLevel }: SettingsDrawerProps) {
  const [sessionNameInput, setSessionNameInput] = useState<string | undefined>();
  const renameFeature = state.actions.features.find((feature) => feature.id === "session.rename");
  const thinkingFeature = state.actions.features.find((feature) => feature.id === "thinking.level");
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
      </Stack>
    </Drawer>
  );
}
