import { Box, Group, Text } from "@mantine/core";
import type { BashCard as BashCardData } from "../../../shared/protocol.js";
import { MANTINE_COLOR, THEME } from "../../ui/theme.js";

const STATUS_COLOR: Record<BashCardData["status"], string> = {
  running: MANTINE_COLOR.warning,
  success: MANTINE_COLOR.success,
  error: MANTINE_COLOR.danger,
  cancelled: MANTINE_COLOR.danger,
};

const MAX_COMMAND = 160;

function commandSubject(command: string): string {
  const line = command.replace(/\\s+/g, " ").trim();
  return line.length > MAX_COMMAND ? `${line.slice(0, MAX_COMMAND - 1)}…` : line;
}

export function BashCard({ bash }: { bash: BashCardData }) {
  const status = bash.status === "running" ? "Running…" : bash.status === "cancelled" ? "Cancelled"
    : bash.exitCode !== undefined ? `Exit ${bash.exitCode}` : "Execution failed";
  const command = commandSubject(bash.command);
  return (
    <Box
      component="details"
      className={`tool-card ${bash.status}`}
      data-testid="bash-card"
      style={{ border: `1px solid ${THEME.border.default}`, borderRadius: "var(--mantine-radius-md)", background: THEME.surface.panel, fontSize: 13 }}
    >
      <Box component="summary" data-testid="bash-details" style={{ cursor: "pointer", listStyle: "none", padding: "8px 12px", userSelect: "none" }}>
        <Group gap="sm" wrap="nowrap">
          <Box w={8} h={8} className={bash.status === "running" ? "tool-running-pulse" : undefined} style={{ borderRadius: "50%", background: `var(--mantine-color-${STATUS_COLOR[bash.status]}-6)`, flex: "none" }} />
          <Text ff="monospace" fw={600} size="sm" style={{ flex: "none" }}>bash</Text>
          <Text ff="monospace" size="xs" c="dimmed" truncate flex={1} title={bash.command} data-testid="bash-command">{command}</Text>
        </Group>
      </Box>
      <Box px="sm" pb="sm" style={{ borderTop: `1px solid ${THEME.border.default}` }}>
        <Text size="xs" c="dimmed" mt="sm">{bash.excludeFromContext ? "Excluded from model context" : "Included in next prompt"} · {status}</Text>
        <Box component="pre" m={0} mt="xs" p="sm" ff="monospace" fz={12} lh={1.5} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: THEME.surface.page, border: `1px solid ${THEME.border.default}`, borderRadius: "var(--mantine-radius-sm)" }}>{bash.output}</Box>
        {bash.truncated ? <Text size="xs" c="dimmed" mt="xs">Output truncated.</Text> : null}
        {bash.fullOutputPath ? <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>Full output: {bash.fullOutputPath}</Text> : null}
      </Box>
    </Box>
  );
}
