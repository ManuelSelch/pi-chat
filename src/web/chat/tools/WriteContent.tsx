import { Box, Text } from "@mantine/core";
import type { ToolCard } from "../../../shared/protocol.js";
import { FileContent } from "./FileContent.js";

export function WriteContent({ content, status, path }: { content: NonNullable<ToolCard["writeContent"]>; status: ToolCard["status"]; path?: string }) {
  const label = status === "success" ? "Written content" : status === "error" ? "Attempted content" : "Content to write";
  return <>
    <Text size="xs" fw={650} c="dimmed" mt="sm" mb={4}>{label}</Text>
    <Box role="region" aria-label={label} tabIndex={0} className="write-content" style={{ maxHeight: 420, overflow: "auto", maxWidth: "100%", overflowWrap: "anywhere" }}>
      {content.text === "" ? <Text size="sm" c="dimmed">Empty file</Text> : <FileContent path={path}>{content.text}</FileContent>}
    </Box>
    {content.truncated ? <Text size="xs" c="dimmed">Content truncated — only part of the file is shown.</Text> : null}
  </>;
}
