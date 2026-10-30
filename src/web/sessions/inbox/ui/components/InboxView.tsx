import { useLayoutEffect, useRef } from "react";
import { ActionIcon, Alert, Box, Drawer, Group, ScrollArea, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconClockPause, IconSearch, IconSettings, IconX } from "@tabler/icons-react";
import type { InboxRow } from "../../domain/inbox-model.js";
import { InboxRowView } from "./InboxRowView.js";
import { focusComposer, useComposerFocusReturn } from "../../../../ui/focus/composer-focus.js";
import styles from "./Inbox.module.css";

export interface InboxViewProps {
  opened: boolean; presentation: "sidebar" | "drawer"; activeSessionId: string; pending: boolean; error?: string;
  rows: readonly InboxRow[]; later: readonly InboxRow[];
  query: string; onQuery(value: string): void;
  workingOpen: boolean; onWorkingToggle(): void; laterOpen: boolean; onLaterToggle(): void;
  onClose(): void; onSettings(): void; onSelect(id: string): void; onPark(id: string): void; onArchive(path: string): void; onResume(path: string): void;
}
export function InboxView(p: InboxViewProps) {
  const focusReturn = useComposerFocusReturn(p.opened && p.presentation === "drawer");
  const panel = useRef<HTMLElement>(null);
  const hadFocus = useRef(false);
  const previous = useRef(p.presentation);
  useLayoutEffect(() => {
    const wasDrawer = previous.current === "drawer";
    previous.current = p.presentation;
    if (document.querySelector('[role="dialog"]')) return;
    if (!p.opened && hadFocus.current) {
      hadFocus.current = false;
      if (!focusComposer()) document.querySelector<HTMLElement>("[data-projects-toggle]")?.focus();
    } else if (p.opened && p.presentation === "sidebar" && wasDrawer) {
      panel.current?.querySelector<HTMLElement>("input, button")?.focus();
    }
  }, [p.opened, p.presentation]);

  const row = (item: InboxRow, later = false) => <InboxRowView key={item.key} row={item}
    active={!later && item.sessionId === p.activeSessionId} later={later} pending={p.pending}
    onSelect={() => later ? item.path && p.onResume(item.path) : item.sessionId && p.onSelect(item.sessionId)}
    onPark={() => item.sessionId && p.onPark(item.sessionId)} onArchive={() => item.path && p.onArchive(item.path)} />;
  const section = (label: string, rows: readonly InboxRow[], collapsible = false) => <section className="mb-4" aria-label={label}>
    {collapsible ? <UnstyledButton className="mb-1 flex w-full items-center justify-between px-2 py-1" aria-expanded={p.workingOpen} onClick={p.onWorkingToggle}>
      <span className="flex items-center gap-1"><IconChevronRight size={12} className={p.workingOpen ? "rotate-90" : ""} /><Text component="span" size="xs" c="dimmed">{label}</Text></span>
      <Text component="span" size="xs" c="dimmed">{rows.length}</Text>
    </UnstyledButton> : <Group justify="space-between" px="xs" py={4}><Text size="xs" c="dimmed">{label}</Text><Text size="xs" c="dimmed">{rows.length}</Text></Group>}
    {(!collapsible || p.workingOpen) && rows.map(item => row(item))}
  </section>;
  const content = <div className="flex h-full min-h-0 flex-col gap-3 p-3">
    <Group justify="flex-end"><ActionIcon color="gray" variant="subtle" aria-label="Close sessions" onClick={p.onClose}><IconX size={18} /></ActionIcon></Group>
    <TextInput aria-label="Search sessions" placeholder="Search sessions…" size="xs" value={p.query} leftSection={<IconSearch size={14} />}
      onChange={event => p.onQuery(event.currentTarget.value)} />
    {p.error && <Alert color="red" role="alert">{p.error}</Alert>}
    <ScrollArea className="min-h-0 flex-1">
      {section("Needs you", p.rows.filter(item => item.status === "blocked"))}
      {section("Ready", p.rows.filter(item => item.status === "idle"))}
      {section("Working", p.rows.filter(item => item.status === "running"), true)}
      {!p.rows.length && <Text size="xs" c="dimmed" ta="center" py="xl">{p.query ? "No open sessions match." : "Inbox clear"}</Text>}
    </ScrollArea>
    <div className="max-h-[37%] shrink-0 overflow-auto border-t border-[var(--mantine-color-default-border)] pt-2">
      <UnstyledButton className="flex w-full items-center gap-2 px-1 py-2" aria-expanded={p.laterOpen} onClick={p.onLaterToggle}>
        {p.laterOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}<IconClockPause size={14} />
        <Text component="span" size="xs" c="dimmed">Later</Text><Text component="span" size="xs" c="dimmed" className="ml-auto">{p.later.length}</Text>
      </UnstyledButton>
      {p.laterOpen && (p.later.length ? p.later.map(item => row(item, true)) : <Text size="xs" c="dimmed" p="xs">{p.query ? "No Later sessions match." : "No sessions in Later."}</Text>)}
    </div>
    <div className="shrink-0 border-t border-[var(--mantine-color-default-border)] pt-2">
      <ActionIcon variant="subtle" color="gray" aria-label="Settings" title="Settings" onClick={p.onSettings}><IconSettings size={19} /></ActionIcon>
    </div>
  </div>;
  if (p.presentation === "drawer") return <Drawer.Root {...focusReturn} opened={p.opened} onClose={p.onClose} size={320} padding={0}>
    <Drawer.Overlay />
    <Drawer.Content aria-label="Sessions"><Drawer.Body h="100dvh">{content}</Drawer.Body></Drawer.Content>
  </Drawer.Root>;
  return p.opened ? <Box component="nav" aria-label="Sessions" data-projects-sidebar ref={panel}
    className={`${styles.panel} fixed bottom-0 left-0 z-100 flex flex-col`}
    style={{ top: "var(--pi-header-height, 58px)", width: "var(--pi-projects-width, 288px)" }}
    onFocusCapture={() => { hadFocus.current = true; }}
    onBlurCapture={event => { if (event.relatedTarget) hadFocus.current = event.currentTarget.contains(event.relatedTarget as Node); }}>
    {content}
  </Box> : null;
}
