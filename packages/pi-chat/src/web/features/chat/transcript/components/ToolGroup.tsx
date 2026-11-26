import { memo } from "react";
import { Box, Text } from "@mantine/core";
import type { ChatMessage } from "../../../../../shared/protocol.js";
import { ToolCard } from "../../tools/components/ToolCard.js";
import { ThinkingPanel } from "./ThinkingPanel.js";
import { THEME } from "../../../../config/theme.js";

export type ToolMessage = Extract<ChatMessage, { role: "tool" }>;
export type ActivityMessage = ToolMessage | { id: string; role: "thinking"; thinking: string; streaming?: boolean };

/** MCP action names stay in the cards; the group only needs each server. */
function summaryName(name: string): string {
  const server = /^mcp__([^_]+(?:_[^_]+)*)__.+$/.exec(name)?.[1];
  if (!server) return name;
  return server.split(/[_-]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

/** One closed disclosure for tools and reasoning, in transcript order. */
export const ToolGroup = memo(function ToolGroup({ messages, onLocalLink }: { messages: ActivityMessage[]; onLocalLink?: (path: string) => void }) {
  const names = new Set<string>();
  let total = 0;
  let running = 0;
  let failed = 0;
  for (const message of messages) {
    if (message.role !== "tool") continue;
    const { tool } = message;
    names.add(summaryName(tool.name));
    total++;
    if (tool.status === "running") running++;
    if (tool.status === "error") failed++;
  }
  if (!total) return <>{messages.map((message) => message.role === "thinking"
    ? <ThinkingPanel key={message.id} thinking={message.thinking} streaming={message.streaming ?? false} autoExpand={false} onLocalLink={onLocalLink} />
    : null)}</>;
  const summary = `Used ${total} ${Array.from(names).join(", ")}`;
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
