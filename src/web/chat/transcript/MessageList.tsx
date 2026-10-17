import { memo, useState } from "react";
import { Box, Button, Center, Paper, Stack, Text, Title } from "@mantine/core";
import { Notice } from "../../ui/Notice.js";
import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { Markdown } from "../markdown/MarkdownLazy.js";
import { ThinkingPanel } from "./ThinkingPanel.js";
import { BashCard } from "../bash/BashCard.js";
import { ToolCard } from "../tools/ToolCard.js";
import { SkillInvocation } from "./SkillInvocation.js";
import { ToolGroup, type ToolMessage } from "./ToolGroup.js";
import type { ChatMessage } from "../../../shared/protocol.js";
import type { ChatState } from "../../app/state/chat-state.js";
import { THEME } from "../../ui/theme.js";

/**
 * Rendering markdown, KaTeX, and highlighting is expensive, and a long session
 * holds hundreds of entries. Each row is memoised so typing in the composer or
 * receiving a streaming delta only re-renders what actually changed.
 */
const MessageRow = memo(function MessageRow({ message, onLocalLink, compact }: { message: ChatMessage; onLocalLink?: (path: string) => void; compact: boolean }) {
  if (message.role === "tool") return <ToolCard tool={message.tool} compact={compact} />;
  if (message.role === "bash") return <BashCard bash={message.bash} />;

  if (message.role === "notice") {
    return (
      <Notice
        tone={message.level === "error" ? "danger" : message.level === "warning" ? "warning" : "info"}
        icon={message.level === "info" ? <IconInfoCircle size={16} /> : <IconAlertTriangle size={16} />}
        p="xs"
      >
        {/* Notices are command output, not model-authored Markdown. Preserve
            their exact line breaks and indentation (for example, aligned branch
            listings) instead of letting Markdown collapse whitespace. */}
        <div className="markdown markdown-notice"><pre>{message.text}</pre></div>
      </Notice>
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
        style={{ borderLeft: `3px solid ${THEME.accent.primary}` }}
      >
        <Text size="xs" fw={650} tt="uppercase" lts={1} mb={4} c={THEME.accent.primary}>
          {message.customType}
        </Text>
        <div className="markdown"><Markdown onLocalLink={onLocalLink}>{message.text}</Markdown></div>
      </Box>
    );
  }

  return (
    <Box component="article">
      {message.role === "assistant" && !compact ? (
        <Text size="xs" fw={650} c="dimmed" tt="uppercase" lts={1} mb={4}>Pi</Text>
      ) : null}
      {message.role === "assistant" && message.thinking ? (
        <ThinkingPanel thinking={message.thinking} streaming={false} onLocalLink={onLocalLink} />
      ) : null}
      {/* A turn can be reasoning plus a tool call and no prose at all; the
          panel above is then the whole message. */}
      {message.role === "assistant" && message.text === "" ? null : message.role === "user" ? (
        <>
          {message.skill ? <SkillInvocation skill={message.skill} compact={compact} onLocalLink={onLocalLink} /> : null}
          {message.text ? (
            <Paper bg={THEME.surface.panelHover} radius="lg" p="sm" px="md" ml="auto" maw="82%" mt={message.skill ? "sm" : undefined}>
              <div className="markdown"><Markdown onLocalLink={onLocalLink}>{message.text}</Markdown></div>
            </Paper>
          ) : null}
        </>
      ) : (
        <div className="markdown"><Markdown onLocalLink={onLocalLink}>{message.text}</Markdown></div>
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
  onLocalLink?: (path: string) => void;
  compact?: boolean;
}

export const MessageList = memo(function MessageList({ messages, draft, onLocalLink, compact = false }: MessageListProps) {
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  let start = Math.max(0, messages.length - visible);
  // Never show a partial count when pagination cuts through a tool group.
  if (compact) {
    while (start > 0 && messages[start]?.role === "tool" && messages[start - 1]?.role === "tool") start--;
  }
  const shown = messages.slice(start);
  const hidden = start;
  const rows: (ChatMessage | [ToolMessage, ...ToolMessage[]])[] = [];
  for (const message of shown) {
    const previous = rows[rows.length - 1];
    if (compact && message.role === "tool") {
      if (Array.isArray(previous)) previous.push(message);
      else rows.push([message]);
    } else rows.push(message);
  }

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
      <Stack gap="md" component="section" aria-live="polite" className={compact ? "transcript-compact" : undefined}>
        {hidden > 0 ? (
          <Button variant="subtle" size="compact-sm" onClick={() => setVisible((count) => count + OLDER_STEP)}>
            Show earlier messages ({hidden})
          </Button>
        ) : null}
        {rows.map((row) => Array.isArray(row)
          ? <ToolGroup key={`tools:${row[0].id}`} messages={row} />
          : <MessageRow key={row.id} message={row} onLocalLink={onLocalLink} compact={compact} />)}
        {draft ? (
          <Box component="article">
            {!compact ? (
              <Text size="xs" fw={650} c="dimmed" tt="uppercase" lts={1} mb={4}>Pi</Text>
            ) : null}
            {draft.thinking ? (
              // Still "streaming" once prose starts arriving is deliberate: the
              // panel only settles when the turn does, so it does not collapse
              // out from under a reader mid-sentence.
              <ThinkingPanel thinking={draft.thinking} streaming onLocalLink={onLocalLink} />
            ) : null}
            <div className="markdown">
              <Markdown onLocalLink={onLocalLink}>{draft.text}</Markdown>
              <span className="stream-cursor" />
            </div>
          </Box>
        ) : null}
      </Stack>
    </>
  );
});
