import { memo } from "react";
import { Box, Text } from "@mantine/core";
import type { ChatMessage } from "../../../shared/protocol.js";
import { ToolCard } from "../tools/ToolCard.js";
import { THEME } from "../../ui/theme.js";

export type ToolMessage = Extract<ChatMessage, { role: "tool" }>;

/** One native disclosure per consecutive run; individual tool details stay intact. */
export const ToolGroup = memo(function ToolGroup({ messages }: { messages: ToolMessage[] }) {
  const counts = new Map<string, number>();
  let running = 0;
  let failed = 0;
  for (const { tool } of messages) {
    counts.set(tool.name, (counts.get(tool.name) ?? 0) + 1);
    if (tool.status === "running") running++;
    if (tool.status === "error") failed++;
  }
  const summary = `Used ${Array.from(counts, ([name, count]) => `${count} ${name}`).join(", ")}`;
  return (
    <Box component="details" className="tool-group" data-testid="tool-group">
      <Box component="summary">
        {summary}
        {running ? <Text component="span" size="xs" ml="xs">· {running} running</Text> : null}
        {failed ? <Text component="span" size="xs" ml="xs" c="red">· {failed} failed</Text> : null}
      </Box>
      <Box mt={6} ml={5} pl="sm" style={{ borderLeft: `1px solid ${THEME.border.default}` }}>
        {messages.map((message) => <ToolCard key={message.id} tool={message.tool} compact />)}
      </Box>
    </Box>
  );
});
