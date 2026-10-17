import { memo } from "react";
import { Box, Text } from "@mantine/core";
import type { ChatMessage } from "../../../shared/protocol.js";
import { ToolCard } from "../tools/ToolCard.js";
import { ThinkingPanel } from "./ThinkingPanel.js";
import { THEME } from "../../ui/theme.js";

export type ToolMessage = Extract<ChatMessage, { role: "tool" }>;
export type ActivityMessage = ToolMessage | { id: string; role: "thinking"; thinking: string; streaming?: boolean };

/** One closed disclosure for tools and reasoning, in transcript order. */
export const ToolGroup = memo(function ToolGroup({ messages, onLocalLink }: { messages: ActivityMessage[]; onLocalLink?: (path: string) => void }) {
  const counts = new Map<string, number>();
  let running = 0;
  let failed = 0;
  for (const message of messages) {
    if (message.role !== "tool") continue;
    const { tool } = message;
    counts.set(tool.name, (counts.get(tool.name) ?? 0) + 1);
    if (tool.status === "running") running++;
    if (tool.status === "error") failed++;
  }
  const summary = counts.size
    ? `Used ${Array.from(counts, ([name, count]) => `${count} ${name}`).join(", ")}`
    : "Thinking";
  return (
    <Box component="details" className="tool-group" data-testid="tool-group">
      <Box component="summary">
        {summary}
        {running ? <Text component="span" size="xs" ml="xs">· {running} running</Text> : null}
        {failed ? <Text component="span" size="xs" ml="xs" c="red">· {failed} failed</Text> : null}
      </Box>
      <Box mt={6} ml={5} pl="sm" style={{ borderLeft: `1px solid ${THEME.border.default}` }}>
        {messages.map((message) => message.role === "tool"
          ? <ToolCard key={message.id} tool={message.tool} compact />
          : <ThinkingPanel key={message.id} thinking={message.thinking} streaming={message.streaming ?? false} autoExpand={false} onLocalLink={onLocalLink} />)}
      </Box>
    </Box>
  );
});
