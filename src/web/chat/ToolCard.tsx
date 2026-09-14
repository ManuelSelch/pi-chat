import { Badge, Box, Group, Text } from "@mantine/core";
import type { ToolCard as ToolCardState } from "../../shared/protocol.js";

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
 * The argument that says what a call is actually doing, per tool. A card shows
 * this next to the name so the collapsed bar answers "what is it running?"
 * without being opened. Unlisted tools fall back to the first non-empty string
 * argument, which covers most single-subject tools (`url`, `query`, ...).
 */
const SUBJECT_KEYS: Record<string, string[]> = {
  bash: ["command"],
  edit: ["path"],
  write: ["path"],
  read: ["path"],
  glob: ["pattern"],
  grep: ["pattern"],
};

/** One line, so a multi-line command keeps the header one row tall. */
const MAX_SUBJECT = 160;

function firstStringValue(args: Record<string, unknown>, keys: string[]): string | undefined {
  const ordered = keys.length > 0 ? keys : Object.keys(args);
  for (const key of ordered) {
    const value = args[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
}

/**
 * Arguments arrive as streamed text, so a running call often holds half a JSON
 * object. Parsing is tried first; failing that, the value is read straight out
 * of the fragment so a long `bash` command is legible while it is still
 * arriving, rather than appearing only once the call finishes.
 */
function partialStringValue(argsText: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const match = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`).exec(argsText);
    const raw = match?.[1];
    if (raw === undefined || raw === "") continue;
    // The fragment is a valid JSON string once it is closed off again.
    try {
      return JSON.parse(`"${raw}"`) as string;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** What this call is operating on: a command, a path, a pattern, a URL. */
export function toolSubject(tool: ToolCardState): string | undefined {
  if (tool.argsText === undefined) return undefined;
  const keys = SUBJECT_KEYS[tool.name] ?? [];
  let value: string | undefined;
  try {
    const args: unknown = JSON.parse(tool.argsText);
    if (typeof args !== "object" || args === null) return undefined;
    value = firstStringValue(args as Record<string, unknown>, keys);
  } catch {
    value = partialStringValue(tool.argsText, keys);
  }
  if (value === undefined) return undefined;
  const line = value.replace(/\s+/g, " ").trim();
  if (line === "") return undefined;
  return line.length > MAX_SUBJECT ? `${line.slice(0, MAX_SUBJECT - 1)}…` : line;
}

/**
 * One tool call, collapsed by default so tools never dominate the transcript.
 * Native details/summary keeps it keyboard-operable without state. Arguments
 * and output render as plain text — never as markup — so tool output cannot
 * inject anything.
 */
export function ToolCard({ tool }: { tool: ToolCardState }) {
  const subject = toolSubject(tool);
  return (
    <Box
      component="details"
      className={`tool-card ${tool.status}`}
      data-testid="tool-card"
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
          <Text ff="monospace" fw={600} size="sm" style={{ flex: "none" }}>{tool.name}</Text>
          {subject ? (
            <Text ff="monospace" size="xs" c="dimmed" truncate flex={1} title={subject} data-testid="tool-subject">
              {subject}
            </Text>
          ) : (
            <Box flex={1} />
          )}
          {/* The dot already carries running and success; only a failure is
              worth the extra width. */}
          {tool.status === "error" ? (
            <Badge color={STATUS_COLOR.error} variant="light" size="sm" style={{ flex: "none" }}>
              {STATUS_LABEL.error}
            </Badge>
          ) : null}
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
