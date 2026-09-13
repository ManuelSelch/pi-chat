import { Alert, Box, Center, Paper, Stack, Text, Title } from "@mantine/core";
import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { Markdown } from "./Markdown.js";
import { ToolCard } from "./ToolCard.js";
import type { ChatState } from "./chat-state.js";

export function MessageList({ state }: { state: ChatState }) {
  return (
    <>
      {state.messages.length === 0 && !state.draft ? (
        <Center mt="20vh">
          <Stack align="center" gap="xs">
            <Title order={1} fw={500}>What would you like to explore?</Title>
            <Text c="dimmed">A minimal local chat powered by your Pi session.</Text>
          </Stack>
        </Center>
      ) : null}

      <Stack gap="xl" component="section" aria-live="polite">
        {state.messages.map((message) =>
          message.role === "tool" ? (
            <ToolCard key={message.id} tool={message.tool} />
          ) : message.role === "notice" ? (
            <Alert
              key={message.id}
              variant="light"
              color={message.level === "error" ? "red" : message.level === "warning" ? "yellow" : "blue"}
              icon={message.level === "info" ? <IconInfoCircle size={16} /> : <IconAlertTriangle size={16} />}
              p="xs"
            >
              <Text size="sm">{message.text}</Text>
            </Alert>
          ) : (
            <Box key={message.id} component="article">
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
          ),
        )}
        {state.draft ? (
          <Box component="article">
            <Text size="xs" fw={650} c="dimmed" tt="uppercase" lts={1} mb={6}>Pi</Text>
            <div className="markdown">
              <Markdown>{state.draft.text}</Markdown>
              <span className="stream-cursor" />
            </div>
          </Box>
        ) : null}
      </Stack>
    </>
  );
}
