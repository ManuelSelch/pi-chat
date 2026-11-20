import { ActionIcon, Alert, Button, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconAlertCircle, IconPlus, IconRefresh } from "@tabler/icons-react";

export type CounterState = "ready" | "loading" | "disconnected" | "error" | "unavailable";

interface CounterPanelProps {
  count: number | null;
  state: CounterState;
  busy: boolean;
  onIncrement: () => void;
  onRefresh: () => void;
}

export function CounterPanel({ count, state, busy, onIncrement, onRefresh }: CounterPanelProps) {
  const unavailable = state === "unavailable";
  const disconnected = state === "disconnected";
  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap">
        <Text fw={600} size="sm">Counter</Text>
        <Text size="xs" c="dimmed">Plugin demo</Text>
      </Group>
      <Group justify="space-between" align="center" wrap="nowrap">
        <Text className="counter-value" aria-label="Count" aria-live="polite">{state === "loading" ? "…" : count ?? "—"}</Text>
        <Tooltip label="Read current count">
          <ActionIcon variant="subtle" color="gray" aria-label="Read current count" onClick={onRefresh}
            disabled={disconnected || unavailable || busy} loading={state === "loading"}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {state === "error" && <Alert color="red" icon={<IconAlertCircle size={16} />}>Result unknown. Read the count before trying again.</Alert>}
      {disconnected && <Text size="sm" c="dimmed" role="status">Disconnected</Text>}
      {unavailable && <Text size="sm" c="dimmed" role="status">Counter plugin unavailable on this server.</Text>}
      <Button leftSection={<IconPlus size={16} />} onClick={onIncrement} loading={busy}
        disabled={disconnected || unavailable || state === "loading" || state === "error"} fullWidth>
        Increment
      </Button>
    </Stack>
  );
}
