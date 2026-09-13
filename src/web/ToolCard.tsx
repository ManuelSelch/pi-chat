import { Badge, Box, Group, Text } from "@mantine/core";
import type { ToolCard as ToolCardState } from "../shared/protocol.js";

const STATUS_COLOR: Record<ToolCardState["status"], string> = {
  running: "yellow",
  success: "green",
  error: "red",
};

const STATUS_LABEL: Record<ToolCardState["status"], string> = {
  running: "Running",
  success: "Done",
  error: "Failed",
};

/**
 * One tool call, collapsed by default so tools never dominate the transcript.
 * Native details/summary keeps it keyboard-operable without state. Arguments
 * and output render as plain text — never as markup — so tool output cannot
 * inject anything.
 */
export function ToolCard({ tool }: { tool: ToolCardState }) {
  return (
    <Box
      component="details"
      className={`tool-card ${tool.status}`}
      data-testid="tool-card"
      mb="xl"
      style={{
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: "var(--mantine-radius-md)",
        background: "var(--mantine-color-default)",
        fontSize: 13,
      }}
    >
      <Box
        component="summary"
        style={{ cursor: "pointer", listStyle: "none", padding: "8px 12px", userSelect: "none" }}
      >
        <Group gap="sm" wrap="nowrap">
          <Box
            w={8}
            h={8}
            className={tool.status === "running" ? "tool-running-pulse" : undefined}
            style={{ borderRadius: "50%", background: `var(--mantine-color-${STATUS_COLOR[tool.status]}-filled)`, flex: "none" }}
          />
          <Text ff="monospace" fw={600} size="sm">{tool.name}</Text>
          <Badge color={STATUS_COLOR[tool.status]} variant="light" size="sm">{STATUS_LABEL[tool.status]}</Badge>
        </Group>
      </Box>
      {tool.argsText !== undefined || tool.outputText !== undefined ? (
        <Box px="sm" pb="sm" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
          {tool.argsText !== undefined ? (
            <>
              <Text size="xs" fw={650} c="dimmed" tt="uppercase" lts={1} mt="sm" mb={4}>Arguments</Text>
              <ToolPre>{tool.argsText}</ToolPre>
            </>
          ) : null}
          {tool.outputText !== undefined ? (
            <>
              <Text size="xs" fw={650} c="dimmed" tt="uppercase" lts={1} mt="sm" mb={4}>
                {tool.status === "running" ? "Output so far" : "Result"}
              </Text>
              <ToolPre>{tool.outputText}</ToolPre>
            </>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

function ToolPre({ children }: { children: string }) {
  return (
    <Box
      component="pre"
      m={0}
      p="sm"
      ff="monospace"
      fz={12}
      lh={1.5}
      mah={260}
      style={{
        overflow: "auto",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        background: "var(--mantine-color-body)",
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: "var(--mantine-radius-sm)",
      }}
    >
      {children}
    </Box>
  );
}
