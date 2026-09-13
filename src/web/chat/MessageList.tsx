import { memo } from "react";
import { Alert, Box, Center, Paper, Stack, Text, Title } from "@mantine/core";
import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { Markdown } from "./Markdown.js";
import { ToolCard } from "./ToolCard.js";
import type { ChatMessage } from "../../shared/protocol.js";
import type { ChatState } from "./chat-state.js";

/**
 * Rendering markdown, KaTeX, and highlighting is expensive, and a long session
 * holds hundreds of entries. Each row is memoised so typing in the composer or
 * receiving a streaming delta only re-renders what actually changed.
 */
const MessageRow = memo(function MessageRow({ message }: { message: ChatMessage }) {
  if (message.role === "tool") return <ToolCard tool={message.tool} />;

  if (message.role === "notice") {
    return (
      <Alert
        variant="light"
        color={message.level === "error" ? "red" : message.level === "warning" ? "yellow" : "blue"}
        icon={message.level === "info" ? <IconInfoCircle size={16} /> : <IconAlertTriangle size={16} />}
        p="xs"
      >
        <Text size="sm">{message.text}</Text>
      </Alert>
    );
  }

  return (
    <Box component="article">
      {message.role === "assistant" ? (
        <Text size="xs" fw={650} c="dimmed" tt="uppercase" lts={1} mb={6}>Pi</Text>
      ) : null}
      {message.role === "user" ? (
        <Paper bg="var(--mantine-color-default-hover)" radius="lg" p="sm" px="md" ml="auto" maw="82%">
          <div className="markdown"><Markdown>{message.text}</Markdown></div>
        </Paper>
      ) : (
        <div className="markdown"><Markdown>{message.text}</Markdown></div>
      )}
    </Box>
  );
});

interface MessageListProps {
  messages: ChatState["messages"];
  draft: ChatState["draft"];
}

export const MessageList = memo(function MessageList({ messages, draft }: MessageListProps) {
  return (
    <>
      {messages.length === 0 && !draft ? (
        <Center mt="20vh">
          <Stack align="center" gap="xs">
            <Title order={1} fw={500}>What would you like to explore?</Title>
            <Text c="dimmed">A minimal local chat powered by your Pi session.</Text>
          </Stack>
        </Center>
      ) : null}

      <Stack gap="xl" component="section" aria-live="polite">
        {messages.map((message) => <MessageRow key={message.id} message={message} />)}
        {draft ? (
          <Box component="article">
            <Text size="xs" fw={650} c="dimmed" tt="uppercase" lts={1} mb={6}>Pi</Text>
            <div className="markdown">
              <Markdown>{draft.text}</Markdown>
              <span className="stream-cursor" />
            </div>
          </Box>
        ) : null}
      </Stack>
    </>
  );
});
