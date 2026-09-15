import { Badge, Group, Text } from "@mantine/core";
import type { ExtensionStatus } from "../../shared/protocol.js";

/**
 * The bottom-left of the terminal footer: the model line, plus whatever labels
 * extensions pinned there with `ctx.ui.setStatus` — `/readonly`'s `READONLY`
 * marker among them.
 *
 * Nothing here knows which extension sent a label. The terminal colours them
 * through its theme, which does not survive the trip to a browser, so they are
 * all shown alike and the label's own wording is what says what it means.
 */
export function StatusBar({ statuses, status }: { statuses: ExtensionStatus[]; status: string }) {
  if (statuses.length === 0 && !status) return null;
  return (
    <Group gap={6} mt={6} pl={12} wrap="wrap" align="center">
      {statuses.map((entry) => (
        <Badge key={entry.key} size="sm" radius="sm" variant="light" color="yellow" tt="none">
          {entry.text}
        </Badge>
      ))}
      {status ? <Text size="xs" c="dimmed">{status}</Text> : null}
    </Group>
  );
}
