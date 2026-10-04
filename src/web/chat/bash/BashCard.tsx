import { Box, Group, Paper, Text } from "@mantine/core";
import type { BashCard as BashCardData } from "../../../shared/protocol.js";

export function BashCard({ bash }: { bash: BashCardData }) {
  const status = bash.status === "running" ? "Running…" : bash.status === "cancelled" ? "Cancelled"
    : bash.exitCode !== undefined ? `Exit ${bash.exitCode}` : "Execution failed";
  return (
    <Paper component="article" withBorder radius="md" p="sm" data-testid="bash-card">
      <Group justify="space-between" gap="xs">
        <Text size="xs" fw={650}>Bash · {status}</Text>
        <Text size="xs" c="dimmed">{bash.excludeFromContext ? "Excluded from model context" : "Included in next prompt"}</Text>
      </Group>
      <Box component="pre" m={0} mt="xs" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{bash.command}</Box>
      {bash.output ? <Box component="pre" m={0} mt="xs" mah={320} style={{ overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{bash.output}</Box> : null}
      {bash.truncated ? <Text size="xs" c="dimmed" mt="xs">Output truncated.</Text> : null}
      {bash.fullOutputPath ? <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>Full output: {bash.fullOutputPath}</Text> : null}
    </Paper>
  );
}
