import { ActionIcon, Alert, Button, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconAlertCircle, IconPlus, IconRefresh } from "@tabler/icons-react";
import type { CounterDemoState } from "../hooks/use-counter-demo.js";
import { MANTINE_COLOR } from "../../../config/theme.js";

interface CounterPanelViewProps {
  state: CounterDemoState;
  connected: boolean;
  onIncrement(): void;
  onRead(): void;
}

export function CounterPanelView({ state, connected, onIncrement, onRead }: CounterPanelViewProps) {
  const unavailable = state.status === "unavailable";
  const loading = connected && state.status === "loading";
  return (
    <Stack gap="md" role="group" aria-label="Counter demo">
      <Group justify="space-between" wrap="nowrap">
        <Text fw={600} size="sm">Counter</Text>
        <Text size="xs" c="dimmed">Plugin demo</Text>
      </Group>
      <Group justify="space-between" align="center" wrap="nowrap">
        <Text component="output" aria-label="Count" aria-live="polite" fz={48} lh={1.2} fw={500} className="tabular-nums">
          {loading ? "…" : state.count ?? "—"}
        </Text>
        <Tooltip label="Read current count">
          <ActionIcon variant="subtle" color={MANTINE_COLOR.neutral} aria-label="Read current count" onClick={onRead}
            disabled={!connected || unavailable || state.busy} loading={loading}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {!connected ? <Text size="sm" c="dimmed" role="status">Disconnected</Text>
        : unavailable ? <Text size="sm" c="dimmed" role="status">Counter plugin unavailable on this server.</Text>
          : state.status === "error" ? <Alert color={MANTINE_COLOR.danger} icon={<IconAlertCircle size={16} />}>{state.error}</Alert> : null}
      <Button leftSection={<IconPlus size={16} />} onClick={onIncrement} loading={state.busy}
        disabled={!connected || state.status !== "ready"} fullWidth>
        Increment
      </Button>
    </Stack>
  );
}
