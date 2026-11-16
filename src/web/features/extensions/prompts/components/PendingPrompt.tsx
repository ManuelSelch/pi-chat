import { Button, Group, Paper, Text, ThemeIcon } from "@mantine/core";
import { IconArrowUpRight, IconMessageQuestion, IconPlayerStop } from "@tabler/icons-react";

export function PendingPrompt({ title, onReopen, onStop, stopDisabled }: { title: string; onReopen(): void; onStop(): void; stopDisabled: boolean }) {
  return <Paper role="region" aria-label="Pending question" withBorder radius="md" p="md" mb="xs">
    <Group wrap="nowrap">
      <ThemeIcon variant="light" size={36}><IconMessageQuestion size={20} /></ThemeIcon>
      <div className="min-w-0 flex-1"><Text size="sm" fw={600}>Question pending</Text><Text size="xs" c="dimmed" lineClamp={1}>{title}</Text></div>
      <Button variant="subtle" color="gray" disabled={stopDisabled} onClick={onStop} leftSection={<IconPlayerStop size={15} />}>Stop</Button>
      <Button data-pending-prompt-reopen variant="light" rightSection={<IconArrowUpRight size={15} />} onClick={onReopen}>Reopen</Button>
    </Group>
  </Paper>;
}
