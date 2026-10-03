import { Alert, Anchor, Box, Container, Group, Paper, Text, Textarea } from "@mantine/core";
import { MANTINE_COLOR, THEME } from "../theme.js";
import type { RefObject, FormEvent, KeyboardEvent } from "react";
import { CommandMenu } from "../commands/CommandMenu.js";
import type { MenuItem } from "../commands/command-menu.js";
import { Footer } from "../chat/Footer.js";
import { WidgetPanel } from "../chat/WidgetPanel.js";
import { Slot } from "../extensions/Slot.js";
import type { FooterItem, PiChatBadge, PiChatButton, Widget } from "../../shared/protocol.js";

export interface FooterViewModel {
  home: boolean;
  connection: "connecting" | "open" | "superseded";
  connecting: boolean;
  error?: string;
  busy: boolean;
  input: string;
  activeCommand: number;
  matches: MenuItem[];
  footerItems: FooterItem[];
  widgetsAbove: Widget[];
  widgetsBelow: Widget[];
  extensions: { buttons: PiChatButton[]; badges: PiChatBadge[] };
}

export interface FooterViewActions {
  takeControl(): void;
  dismissError(): void;
  changeInput(value: string): void;
  keyDown(event: KeyboardEvent<HTMLTextAreaElement>): void;
  submit(event?: FormEvent): void;
  setActiveCommand(index: number): void;
  runMenuItem(item: MenuItem): void;
  runExtensionAction(actionId: string): void;
}

interface FooterViewProps {
  model: FooterViewModel;
  actions: FooterViewActions;
  footerRef: RefObject<HTMLElement | null>;
  composerRef: RefObject<HTMLTextAreaElement | null>;
}

export function FooterView({ model, actions, footerRef, composerRef }: FooterViewProps) {
  const { home, connection, connecting, error, busy, input, activeCommand, matches, footerItems, widgetsAbove, widgetsBelow, extensions } = model;
  const menuOpen = matches.length > 0;

  if (home) return null;

  return (
    <Box
      component="footer"
      ref={footerRef}
      pos="fixed"
      bottom={0}
      left={0}
      right={0}
      pb="md"
      style={{ background: `linear-gradient(transparent, ${THEME.surface.page} 30%)`, pointerEvents: "none" }}
    >
      <Container size="sm" style={{ pointerEvents: "auto" }}>
        {connection === "superseded" ? (
          <Text size="sm" c="dimmed" mb="xs">
            Another browser tab is using this Pi session. <Anchor component="button" type="button" onClick={actions.takeControl}>Take control here</Anchor>
          </Text>
        ) : connecting ? (
          <Text size="sm" c="dimmed" mb="xs">Connecting to the Pi Chat server… the runtime takes a few seconds to start.</Text>
        ) : null}

        {error ? (
          <Alert
            color={MANTINE_COLOR.danger}
            variant="light"
            mb="xs"
            role="alert"
            withCloseButton
            closeButtonLabel="Dismiss error"
            onClose={actions.dismissError}
            styles={{ message: { whiteSpace: "pre-wrap", wordBreak: "break-word" } }}
          >
            {error}
          </Alert>
        ) : null}

        <WidgetPanel widgets={widgetsAbove} />
        {menuOpen ? (
          <div data-command-menu>
            <CommandMenu
              commands={matches}
              activeIndex={activeCommand}
              onHover={actions.setActiveCommand}
              onSelect={actions.runMenuItem}
            />
          </div>
        ) : null}

        <Paper
          component="form"
          onSubmit={actions.submit}
          withBorder
          radius="lg"
          p="xs"
          shadow="md"
          className={busy ? "composer-working" : undefined}
          aria-busy={busy || undefined}
        >
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <Textarea
              ref={composerRef}
              aria-label="Message Pi"
              autosize
              minRows={2}
              maxRows={8}
              onChange={(event) => actions.changeInput(event.currentTarget.value)}
              onKeyDown={actions.keyDown}
              placeholder="Ask Pi anything…"
              value={input}
              variant="unstyled"
              flex={1}
              styles={{ input: { padding: "8px 10px" } }}
            />
            <Slot name="composer.right" buttons={extensions.buttons} badges={extensions.badges} onAction={actions.runExtensionAction} />
          </Group>
        </Paper>
        {widgetsBelow.length > 0 ? <Box mt="xs"><WidgetPanel widgets={widgetsBelow} /></Box> : null}
        <Box mt={6} pl={12}>
          <Slot name="composer.below" buttons={extensions.buttons} badges={extensions.badges} onAction={actions.runExtensionAction} />
        </Box>
        <Footer items={footerItems} />
      </Container>
    </Box>
  );
}
