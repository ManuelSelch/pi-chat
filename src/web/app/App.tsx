import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Anchor, AppShell, Box, Button, Container, Group, Paper, Text, Textarea } from "@mantine/core";
import { MessageList } from "../chat/MessageList.js";
import { usePiChat } from "../chat/use-pi-chat.js";
import { useAutoScroll } from "./use-auto-scroll.js";
import { ProjectSessionDrawer } from "../projects/ProjectSessionDrawer.js";
import { SettingsDrawer } from "../settings/SettingsDrawer.js";

export function App() {
  const chat = usePiChat();
  const { state, prompt, abort, takeControl } = chat;
  const [input, setInput] = useState("");
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const busy = state.status === "running" || state.status === "aborting";
  // The rename action already carries the live session name, so the header does
  // not need its own snapshot field.
  const renameFeature = state.actions.features.find((feature) => feature.id === "session.rename");
  const sessionName = renameFeature?.state.name?.trim();
  const headerTitle = state.projectPath ? sessionName || "New session" : "Connecting…";
  const followKey = `${state.messages.length}:${state.messages.at(-1)?.id ?? ""}:${state.draft?.text.length ?? 0}:${state.status}`;
  const bottomRef = useAutoScroll({ sessionId: state.sessionId, followKey });

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

  return (
    <AppShell header={{ height: 58 }} padding={0}>
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <Text fw={700} size="sm">Pi Chat</Text>
            <Button size="compact-sm" variant="subtle" onClick={() => setProjectsOpen(true)}>Projects</Button>
            <Button size="compact-sm" variant="subtle" onClick={() => setSettingsOpen(true)}>Settings</Button>
            <Text c="dimmed" size="xs" truncate title={state.projectPath}>{headerTitle}</Text>
          </Group>
          <Text c={state.status === "running" ? "green" : "dimmed"} size="xs" tt="capitalize" data-testid="status">
            {state.status}
          </Text>
        </Group>
      </AppShell.Header>

      <ProjectSessionDrawer
        opened={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        state={state}
        busy={busy}
        openProject={chat.openProject}
        openSession={chat.openSession}
        newSession={chat.newSession}
      />
      <SettingsDrawer
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        state={state}
        busy={busy}
        renameSession={chat.renameSession}
        setThinkingLevel={chat.setThinkingLevel}
      />

      <AppShell.Main pb={170}>
        <Container size="sm" py="xl">
          <MessageList state={state} />
          <div ref={bottomRef} aria-hidden="true" style={{ scrollMarginBottom: 190 }} />
        </Container>
      </AppShell.Main>

      <Box
        component="footer"
        pos="fixed"
        bottom={0}
        left={0}
        right={0}
        pb="md"
        style={{ background: "linear-gradient(transparent, var(--mantine-color-body) 30%)", pointerEvents: "none" }}
      >
        <Container size="sm" style={{ pointerEvents: "auto" }}>
          {state.status === "superseded" ? (
            <Text size="sm" c="dimmed" mb="xs">
              Another browser tab is using this Pi session. <Anchor component="button" type="button" onClick={takeControl}>Take control here</Anchor>
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
                <Button color="red" radius="md" disabled={state.status === "aborting"} onClick={abort} type="button">Stop</Button>
              ) : (
                <Button radius="md" disabled={!input.trim() || state.status !== "idle"} type="submit">Send</Button>
              )}
            </Group>
          </Paper>
          <Text size="xs" c="dimmed" mt={6} pl={12}>Enter to send · Shift+Enter for a new line</Text>
        </Container>
      </Box>
    </AppShell>
  );
}
