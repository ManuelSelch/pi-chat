import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ActionIcon, Anchor, AppShell, Box, Button, Container, Group, Modal, Paper, Stack, Text, Textarea, Tooltip } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { IconArrowUp, IconLayoutSidebar, IconPlayerStopFilled, IconSettings } from "@tabler/icons-react";
import { CommandMenu } from "../commands/CommandMenu.js";
import { commandQuery, filterCommands } from "../commands/command-menu.js";
import { MessageList } from "../chat/MessageList.js";
import { usePiChat } from "../chat/use-pi-chat.js";
import { visibleError } from "../chat/app-state.js";
import { useAutoScroll } from "./use-auto-scroll.js";
import { ProjectSessionDrawer } from "../projects/ProjectSessionDrawer.js";
import { PromptModal } from "../prompts/PromptModal.js";
import { SettingsDrawer } from "../settings/SettingsDrawer.js";
import { TabBar } from "../tabs/TabBar.js";
import type { Tab } from "../../shared/protocol.js";

export function App() {
  const chat = usePiChat();
  const { app, state, prompt, abort, takeControl } = chat;
  // Drafts are per tab: switching away must not discard a half-typed message.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [closing, setClosing] = useState<Tab | undefined>();
  const input = drafts[app.activeSessionId] ?? "";
  const [activeCommand, setActiveCommand] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const busy = state.status === "running" || state.status === "aborting";
  const connecting = app.connection === "connecting" && app.tabs.length === 0;
  // The rename action already carries the live session name, so the header does
  // not need its own snapshot field.
  const renameFeature = state.actions.features.find((feature) => feature.id === "session.rename");
  const sessionName = renameFeature?.state.name?.trim();
  const headerTitle = state.projectPath ? sessionName || "New session" : "Connecting…";
  const query = menuDismissed ? undefined : commandQuery(input);
  const matches = query === undefined ? [] : filterCommands(state.actions.commands, query);
  const menuOpen = matches.length > 0;

  function setInput(value: string): void {
    setDrafts((current) => ({ ...current, [app.activeSessionId]: value }));
  }

  function openCommandMenu(): void {
    // Reuses the composer's own slash menu rather than a second palette.
    changeInput("/");
    composerRef.current?.focus();
  }

  // `mod` is Cmd on macOS and Ctrl elsewhere. The empty tag list matters:
  // useHotkeys ignores INPUT/TEXTAREA by default, which would disable these
  // exactly when the composer has focus.
  useHotkeys(
    [
      ["mod+O", () => setProjectsOpen(true)],
      ["mod+K", openCommandMenu],
    ],
    [],
  );

  function changeInput(value: string): void {
    setInput(value);
    setActiveCommand(0);
    setMenuDismissed(false);
  }

  function pickCommand(name: string): void {
    // A trailing space both closes the menu and starts the argument.
    setInput(`/${name} `);
    setActiveCommand(0);
  }
  const followKey = `${state.messages.length}:${state.messages.at(-1)?.id ?? ""}:${state.draft?.text.length ?? 0}:${state.status}`;
  const bottomRef = useAutoScroll({ sessionId: state.sessionId, followKey });

  function submit(event?: FormEvent): void {
    event?.preventDefault();
    const message = input.trim();
    if (!message || state.status !== "idle") return;
    prompt(message);
    setInput("");
    setActiveCommand(0);
    setMenuDismissed(false);
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (menuOpen) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveCommand((index) => (index + step + matches.length) % matches.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pickCommand(matches[activeCommand]!.name);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuDismissed(true);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <AppShell header={{ height: 96 }} padding={0}>
      <AppShell.Header>
        <Group h={58} px="lg" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <Tooltip label="Projects and sessions">
              <ActionIcon variant="subtle" color="gray" aria-label="Projects and sessions" onClick={() => setProjectsOpen(true)}>
                <IconLayoutSidebar size={18} />
              </ActionIcon>
            </Tooltip>
            <Text c="dimmed" size="xs" truncate title={state.projectPath}>{headerTitle}</Text>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Text c={state.status === "running" ? "green" : "dimmed"} size="xs" tt="capitalize" data-testid="status">
              {state.status}
            </Text>
            <Tooltip label="Settings">
              <ActionIcon variant="subtle" color="gray" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
                <IconSettings size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        <TabBar
          tabs={app.tabs}
          activeSessionId={app.activeSessionId}
          onFocus={chat.focusTab}
          onClose={(tab) => (tab.status === "idle" ? chat.closeTab(tab.sessionId) : setClosing(tab))}
          onNew={() => chat.newSession(state.projectPath || undefined)}
        />
      </AppShell.Header>

      {/* Nested prompts stack, so the newest question is the one answered.
          Only the focused tab shows its modal; background tabs go red instead. */}
      <PromptModal prompt={state.prompts.at(-1)} onRespond={chat.respondToPrompt} />

      <Modal opened={Boolean(closing)} onClose={() => setClosing(undefined)} title="Close running session?" centered size="sm">
        <Stack gap="md">
          <Text size="sm">
            “{closing?.title}” is still running. Closing stops the run.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setClosing(undefined)}>Keep open</Button>
            <Button color="red" onClick={() => { chat.closeTab(closing!.sessionId); setClosing(undefined); }}>
              Stop and close
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ProjectSessionDrawer
        opened={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        state={state}
        busy={busy}
        openSession={chat.openSession}
        newSession={chat.newSession}
        deleteSession={chat.deleteSession}
      />
      <SettingsDrawer
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        state={state}
        busy={busy}
        renameSession={chat.renameSession}
        setThinkingLevel={chat.setThinkingLevel}
        setModel={chat.setModel}
        compactSession={chat.compactSession}
      />

      <AppShell.Main pb={170}>
        <Container size="sm" py="xl">
          <MessageList messages={state.messages} draft={state.draft} />
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
          {app.connection === "superseded" ? (
            <Text size="sm" c="dimmed" mb="xs">
              Another browser tab is using this Pi session. <Anchor component="button" type="button" onClick={takeControl}>Take control here</Anchor>
            </Text>
          ) : connecting ? (
            <Text size="sm" c="dimmed" mb="xs">Connecting to the Pi Chat server… the runtime takes a few seconds to start.</Text>
          ) : visibleError(app, state) ? (
            <Text size="sm" c="red" mb="xs" role="alert">{visibleError(app, state)}</Text>
          ) : null}

          {menuOpen ? (
            <CommandMenu
              commands={matches}
              activeIndex={activeCommand}
              onHover={setActiveCommand}
              onSelect={(command) => pickCommand(command.name)}
            />
          ) : null}

          <Paper component="form" onSubmit={submit} withBorder radius="lg" p="xs" shadow="md">
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <Textarea
                ref={composerRef}
                aria-label="Message Pi"
                autosize
                minRows={2}
                maxRows={8}
                onChange={(event) => changeInput(event.currentTarget.value)}
                onKeyDown={keyDown}
                placeholder="Ask Pi anything…"
                value={input}
                variant="unstyled"
                flex={1}
                styles={{ input: { padding: "8px 10px" } }}
              />
              {busy ? (
                <ActionIcon color="red" radius="xl" size="lg" aria-label="Stop" disabled={state.status === "aborting"} onClick={() => abort()} type="button">
                  <IconPlayerStopFilled size={16} />
                </ActionIcon>
              ) : (
                <ActionIcon radius="xl" size="lg" aria-label="Send" disabled={!input.trim() || state.status !== "idle"} type="submit">
                  <IconArrowUp size={18} />
                </ActionIcon>
              )}
            </Group>
          </Paper>
          <Text size="xs" c="dimmed" mt={6} pl={12}>Enter to send · Shift+Enter for a new line</Text>
        </Container>
      </Box>
    </AppShell>
  );
}
