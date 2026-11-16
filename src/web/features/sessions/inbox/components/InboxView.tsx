import { useLayoutEffect, useRef, useState } from "react";
import { ActionIcon, Alert, Box, Drawer, Group, ScrollArea, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconClockPause, IconFolder, IconSettings, IconX } from "@tabler/icons-react";
import type { InboxRow } from "../utils/inbox-model.js";
import { InboxRowView } from "./InboxRowView.js";
import { focusComposer, useComposerFocusReturn } from "../../../../hooks/composer-focus.js";
import styles from "./Inbox.module.css";

export interface InboxViewProps {
  opened: boolean; presentation: "sidebar" | "drawer"; activeSessionId: string; pending: boolean; error?: string;
  rows: readonly InboxRow[]; later: readonly InboxRow[];
  laterOpen: boolean; onLaterToggle(): void;
  onClose(): void; onSettings(): void; onSelect(id: string): void; onOpenSaved(path: string): void; onPark(id: string): void; onArchive(path: string): void; onResume(path: string): void;
}
export function InboxView(p: InboxViewProps) {
  const focusReturn = useComposerFocusReturn(p.opened && p.presentation === "drawer");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
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
    onSelect={() => later ? item.path && p.onResume(item.path) : item.sessionId ? p.onSelect(item.sessionId) : item.path && p.onOpenSaved(item.path)}
    onPark={() => { const target = item.sessionId ?? item.path; if (target) p.onPark(target); }} onArchive={() => item.path && p.onArchive(item.path)} />;
  const projects = new Map<string, InboxRow[]>();
  for (const item of p.rows) {
    const group = projects.get(item.project) ?? [];
    group.push(item);
    projects.set(item.project, group);
  }
  function toggleProject(project: string) {
    setCollapsed(previous => {
      const next = new Set(previous);
      if (next.has(project)) next.delete(project);
      else next.add(project);
      return next;
    });
  }
  const content = <div className="flex h-full min-h-0 flex-col gap-3 p-3">
    <Group justify="flex-end"><ActionIcon color="gray" variant="subtle" aria-label="Close sessions" onClick={p.onClose}><IconX size={18} /></ActionIcon></Group>
    {p.error && <Alert color="red" role="alert">{p.error}</Alert>}
    <ScrollArea className="min-h-0 flex-1">
      <Group justify="space-between" px={10} py={8}><Text size="10px" c="dimmed" tt="uppercase" lts="0.1em">Projects</Text><Text size="10px" c="dimmed">{projects.size}</Text></Group>
      {[...projects].map(([project, rows]) => <section key={project} aria-label={project} className="mb-3">
        <UnstyledButton display="flex" w="100%" pl={2} pr={8} py={8} style={{ alignItems: "center", gap: 8 }} aria-expanded={!collapsed.has(project)} onClick={() => toggleProject(project)}>
          <IconChevronRight size={12} className={collapsed.has(project) ? "" : "rotate-90"} /><IconFolder size={15} className="shrink-0" />
          <Text component="span" size="xs" fw={600} truncate>{project}</Text>
        </UnstyledButton>
        {!collapsed.has(project) && rows.map(item => row(item))}
      </section>)}
      {!p.rows.length && <Text size="xs" c="dimmed" ta="center" py="xl">No sessions</Text>}
    </ScrollArea>
    {p.later.length > 0 && <div className="max-h-[37%] shrink-0 overflow-auto border-t border-[var(--mantine-color-default-border)] pt-2">
      <UnstyledButton display="flex" w="100%" pl={2} pr={4} py={8} style={{ alignItems: "center", gap: 8 }} aria-expanded={p.laterOpen} onClick={p.onLaterToggle}>
        {p.laterOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}<IconClockPause size={14} />
        <Text component="span" size="xs" c="dimmed">Later</Text><Text component="span" size="xs" c="dimmed" ml="auto">{p.later.length}</Text>
      </UnstyledButton>
      {p.laterOpen && p.later.map(item => row(item, true))}
    </div>}
    <div className="shrink-0 pt-2">
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
