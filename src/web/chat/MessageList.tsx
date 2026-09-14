import { memo, useState } from "react";
import { Alert, Box, Button, Center, Paper, Stack, Text, Title } from "@mantine/core";
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
        {/* Command output such as /session is markdown, and a one-line notice
            renders the same either way. */}
        <div className="markdown markdown-notice"><Markdown>{message.text}</Markdown></div>
      </Alert>
    );
  }

  // An extension message is a real part of the transcript, not a notification,
  // so it keeps the ordinary surface and is marked by an accent rather than a
  // filled block: a coloured panel here competes with the answer next to it.
  // Every colour comes from the primary-colour variables, so it follows the
  // theme instead of pinning one hue of its own.
  if (message.role === "custom") {
    return (
      <Box
        component="article"
        data-testid="custom-message"
        pl="sm"
        style={{ borderLeft: "3px solid var(--mantine-primary-color-filled)" }}
      >
        <Text size="xs" fw={650} tt="uppercase" lts={1} mb={4} c="var(--mantine-primary-color-filled)">
          {message.customType}
        </Text>
        <div className="markdown"><Markdown>{message.text}</Markdown></div>
      </Box>
    );
  }

  return (
    <Box component="article">
      {message.role === "assistant" ? (
        <Text size="xs" fw={650} c="dimmed" tt="uppercase" lts={1} mb={4}>Pi</Text>
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

/**
 * Long transcripts are the reason switching tabs felt slow: every row remounts
 * and re-renders markdown, KaTeX and highlighting. Only the tail is rendered
 * until the reader asks for more.
 */
const INITIAL_VISIBLE = 40;
const OLDER_STEP = 100;

interface MessageListProps {
  messages: ChatState["messages"];
  draft: ChatState["draft"];
}

export const MessageList = memo(function MessageList({ messages, draft }: MessageListProps) {
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const shown = messages.length > visible ? messages.slice(-visible) : messages;
  const hidden = messages.length - shown.length;

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

      {/* One gap owns the rhythm: rows must not add their own margins, or a
          tool call between two messages gets counted twice. */}
      <Stack gap="md" component="section" aria-live="polite">
        {hidden > 0 ? (
          <Button variant="subtle" size="compact-sm" onClick={() => setVisible((count) => count + OLDER_STEP)}>
            Show earlier messages ({hidden})
          </Button>
        ) : null}
        {shown.map((message) => <MessageRow key={message.id} message={message} />)}
        {draft ? (
          <Box component="article">
            <Text size="xs" fw={650} c="dimmed" tt="uppercase" lts={1} mb={4}>Pi</Text>
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
