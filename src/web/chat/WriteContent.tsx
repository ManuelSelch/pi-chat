import { Box, Text } from "@mantine/core";
import type { ToolCard } from "../../shared/protocol.js";
import { Markdown } from "./MarkdownLazy.js";

export function WriteContent({ content, status }: { content: NonNullable<ToolCard["writeContent"]>; status: ToolCard["status"] }) {
  const label = status === "success" ? "Written content" : status === "error" ? "Attempted content" : "Content to write";
  return <>
    <Text size="xs" fw={650} c="dimmed" mt="sm" mb={4}>{label}</Text>
    <Box role="region" aria-label={label} tabIndex={0} className="markdown write-content" style={{ maxHeight: 420, overflow: "auto", maxWidth: "100%", overflowWrap: "anywhere" }}>
      {content.text === "" ? <Text size="sm" c="dimmed">Empty file</Text> : <Markdown disableImages>{content.text}</Markdown>}
    </Box>
    {content.truncated ? <Text size="xs" c="dimmed">Content truncated — only part of the file is shown.</Text> : null}
  </>;
}
