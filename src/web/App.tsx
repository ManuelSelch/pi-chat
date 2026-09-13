import { useState, type FormEvent, type KeyboardEvent } from "react";
import {
  Anchor,
  AppShell,
  Badge,
  Box,
  Button,
  Center,
  Container,
  Drawer,
  Group,
  NavLink,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { Markdown } from "./Markdown.js";
import { ToolCard } from "./ToolCard.js";
import { usePiChat } from "./use-pi-chat.js";

export function App() {
  const { state, prompt, abort, openProject, openSession, newSession, takeControl } = usePiChat();
  const [input, setInput] = useState("");
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | undefined>();

  function submit(event?: FormEvent): void {
    event?.preventDefault();
    const message = input.trim();
    if (!message || state.status !== "idle") return;
    prompt(message);
    setInput("");
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  const busy = state.status === "running" || state.status === "aborting";
  const activeProject = state.catalogue.projects.find((project) => project.path === (selectedProject ?? state.projectPath)) ?? state.catalogue.projects[0];

  return (
    <AppShell header={{ height: 58 }} padding={0}>
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <Text fw={700} size="sm">Pi Chat</Text>
            <Button size="compact-sm" variant="subtle" onClick={() => setProjectsOpen(true)}>
              Projects
            </Button>
            <Text c="dimmed" size="xs" truncate>
              {state.projectPath || "Connecting…"}
            </Text>
          </Group>
          <Text c={state.status === "running" ? "green" : "dimmed"} size="xs" tt="capitalize" data-testid="status">
            {state.status}
          </Text>
        </Group>
      </AppShell.Header>

      <Drawer opened={projectsOpen} onClose={() => setProjectsOpen(false)} title="Projects and sessions" size="lg">
        <Group align="flex-start" wrap="nowrap">
          <ScrollArea h="70vh" flex={1}>
            <Stack gap={4}>
              {state.catalogue.projects.map((project) => (
                <NavLink
                  key={project.path}
                  active={project.path === state.projectPath}
                  disabled={!project.exists || busy}
                  label={project.name}
                  description={project.path}
                  rightSection={<Badge size="xs" variant="light">{project.sessionCount}</Badge>}
                  onClick={() => setSelectedProject(project.path)}
                />
              ))}
            </Stack>
          </ScrollArea>
          <ScrollArea h="70vh" flex={1}>
            {activeProject ? (
              <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={650}>{activeProject.name}</Text>
                  <Button size="compact-sm" disabled={busy || !activeProject.exists} onClick={() => { openProject(activeProject.path); setProjectsOpen(false); }}>
                    Open latest
                  </Button>
                </Group>
                <Button variant="light" disabled={busy || !activeProject.exists} onClick={() => { newSession(activeProject.path); setProjectsOpen(false); }}>
                  New session here
                </Button>
                {activeProject.sessions.map((session) => (
                  <NavLink
                    key={session.path}
                    active={session.id === state.sessionId}
                    disabled={busy || !activeProject.exists}
                    label={session.title}
                    description={`${new Date(session.modified).toLocaleString()} · ${session.messageCount} messages`}
                    onClick={() => { openSession(session.path); setProjectsOpen(false); }}
                  />
                ))}
              </Stack>
            ) : (
              <Text c="dimmed">No Pi sessions found yet.</Text>
            )}
          </ScrollArea>
        </Group>
      </Drawer>

      <AppShell.Main pb={170}>
        <Container size="sm" py="xl">
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
        </Container>
      </AppShell.Main>

      <Box
        component="footer"
        pos="fixed"
        bottom={0}
        left={0}
        right={0}
        pb="md"
        style={{
          background: "linear-gradient(transparent, var(--mantine-color-body) 30%)",
          pointerEvents: "none",
        }}
      >
        <Container size="sm" style={{ pointerEvents: "auto" }}>
          {state.status === "superseded" ? (
            <Text size="sm" c="dimmed" mb="xs">
              Another browser tab is using this Pi session.{" "}
              <Anchor component="button" type="button" onClick={takeControl}>Take control here</Anchor>
            </Text>
          ) : state.status === "connecting" ? (
            <Text size="sm" c="dimmed" mb="xs">Connecting to the Pi Chat server… the runtime takes a few seconds to start.</Text>
          ) : state.error ? (
            <Text size="sm" c="red" mb="xs" role="alert">{state.error}</Text>
          ) : null}

          <Paper component="form" onSubmit={submit} withBorder radius="lg" p="xs" shadow="md">
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <Textarea
                aria-label="Message Pi"
                autosize
                minRows={2}
                maxRows={8}
                onChange={(event) => setInput(event.currentTarget.value)}
                onKeyDown={keyDown}
                placeholder="Ask Pi anything…"
                value={input}
                variant="unstyled"
                flex={1}
                styles={{ input: { padding: "8px 10px" } }}
              />
              {busy ? (
                <Button color="red" radius="md" disabled={state.status === "aborting"} onClick={abort} type="button">
                  Stop
                </Button>
              ) : (
                <Button radius="md" disabled={!input.trim() || state.status !== "idle"} type="submit">
                  Send
                </Button>
              )}
            </Group>
          </Paper>
          <Text size="xs" c="dimmed" mt={6} pl={12}>Enter to send · Shift+Enter for a new line</Text>
        </Container>
      </Box>
    </AppShell>
  );
}

