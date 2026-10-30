import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActionIcon, Alert, Box, Button, Divider, Drawer, Group, ScrollArea, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconChevronRight, IconFolder, IconFolderOff, IconMessage, IconPin, IconPinnedOff, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { MANTINE_COLOR } from "../../ui/theme.js";
import { StatusBadge } from "../../ui/StatusBadge.js";
import type { ProjectCatalogue } from "../../app/state/view-types.js";
import { buildPanelGroups, type PanelGroup, type PanelSession } from "./project-panel-model.js";
import { SessionRow } from "./SessionRow.js";
import styles from "./ProjectSessionDrawer.module.css";
import { focusComposer, useComposerFocusReturn } from "../../ui/focus/composer-focus.js";

interface ProjectSessionDrawerProps {
  opened: boolean;
  presentation: "sidebar" | "drawer";
  onClose: () => void;
  currentSessionPath: string;
  currentProjectPath: string;
  catalogue: ProjectCatalogue;
  /** A run only blocks archiving the session it is writing to; opening and
   *  starting sessions stays safe meanwhile. */
  busy: boolean;
  showDisplayPath: boolean;
  hideArchivedSessions?: boolean;
  openSession: (path: string) => void;
  newSession: (path?: string) => void;
  onOpenFolder: () => void;
  archiveSession?: (path: string, archived: boolean) => Promise<void>;
  pinProject?: (path: string, pinned: boolean) => Promise<void>;
  removeProject?: (path: string) => Promise<void>;
  busySessionPaths?: readonly string[];
}

/** Repository and folder key the current session belongs to. */
function groupKeyForPath(catalogue: ProjectCatalogue, path: string): string | undefined {
  const project = catalogue.projects.find(candidate => candidate.path === path);
  return project ? project.repositoryPath ?? project.path : undefined;
}

export const ProjectSessionDrawer = memo(function ProjectSessionDrawer({ opened, presentation, onClose, currentSessionPath, currentProjectPath, catalogue, busy, showDisplayPath, hideArchivedSessions = true, openSession, newSession, onOpenFolder, archiveSession, pinProject, removeProject, busySessionPaths = [] }: ProjectSessionDrawerProps) {
  const focusReturn = useComposerFocusReturn(opened && presentation === "drawer");
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarHadFocus = useRef(false);
  const previousPresentation = useRef(presentation);
  useLayoutEffect(() => {
    const previous = previousPresentation.current;
    previousPresentation.current = presentation;
    if (document.querySelector('[role="dialog"]')) return;
    if (!opened && sidebarHadFocus.current) {
      sidebarHadFocus.current = false;
      if (!focusComposer()) document.querySelector<HTMLElement>("[data-projects-toggle]")?.focus();
    } else if (opened && presentation === "sidebar" && previous === "drawer") {
      // The removed phone dialog owned focus. Transfer it into its replacement.
      sidebarRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }, [opened, presentation]);
  const [selected, setSelected] = useState<string>();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedArchive, setExpandedArchive] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const groups = useMemo(() => buildPanelGroups(catalogue, currentProjectPath), [catalogue, currentProjectPath]);
  const quickChats = groups.find(group => group.quickChats);
  const projects = groups.filter(group => !group.quickChats);
  const pinned = projects.filter(group => group.pinned);
  const unpinned = projects.filter(group => !group.pinned);
  const recent = unpinned.filter(group => group.activeCount > 0);
  const other = unpinned.filter(group => group.activeCount === 0);
  const currentKey = groupKeyForPath(catalogue, currentProjectPath);
  const activeKey = selected ?? currentKey;
  const running = busy ? [...busySessionPaths, currentSessionPath] : busySessionPaths;

  const isOpen = (group: PanelGroup): boolean => {
    const explicit = expanded[group.key];
    if (explicit !== undefined) return explicit;
    return group.key === currentKey;
  };

  async function mutate(operation: () => Promise<void>): Promise<void> {
    if (pending) return;
    setPending(true); setError(undefined);
    try { await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update project metadata."); }
    finally { setPending(false); }
  }

  function archive(entry: PanelSession): void {
    if (!archiveSession) return;
    const archived = entry.session.archivedAt !== undefined;
    void mutate(() => archiveSession(entry.session.path, !archived));
  }

  function sessionList(group: PanelGroup) {
    const active = group.sessions.filter(entry => entry.session.archivedAt === undefined);
    const archived = group.sessions.filter(entry => entry.session.archivedAt !== undefined);
    const row = (entry: PanelSession) => (
      <SessionRow key={entry.session.path} session={entry.session} label={entry.worktreeLabel ? entry.branch : undefined}
        active={entry.session.path === currentSessionPath} disabled={!group.exists}
        archiveDisabled={pending || running.includes(entry.session.path)}
        onOpen={() => openSession(entry.session.path)}
        onArchive={archiveSession ? () => archive(entry) : undefined} />
    );
    return (
      <div className={styles.sessions}>
        {active.length ? active.map(row) : <div className={styles.empty}>No sessions yet. Use + to start one.</div>}
        {!hideArchivedSessions && archived.length ? <>
          <button type="button" className={styles.archivedToggle} aria-expanded={Boolean(expandedArchive[group.key])} onClick={() => setExpandedArchive(value => ({ ...value, [group.key]: !value[group.key] }))}>
            <IconChevronRight size={12} className={expandedArchive[group.key] ? styles.groupChevronOpen : undefined} />
            <span>Archived</span>
            <StatusBadge>{archived.length}</StatusBadge>
          </button>
          {expandedArchive[group.key] ? archived.map(row) : null}
        </> : null}
      </div>
    );
  }

  function groupRow(group: PanelGroup) {
    const open = isOpen(group);
    const active = group.key === activeKey;
    return (
      <div key={group.key}>
        <div className={styles.groupRow}>
          <UnstyledButton className={styles.groupMain} aria-expanded={open} aria-current={active ? "true" : undefined}
            onClick={() => { setSelected(group.key); setExpanded(value => ({ ...value, [group.key]: !open })); }}>
            <IconChevronRight size={14} className={`${styles.groupChevron}${open ? ` ${styles.groupChevronOpen}` : ""}`} />
            {group.quickChats ? <IconMessage size={16} className={styles.groupIcon} />
              : group.exists ? <IconFolder size={16} className={styles.groupIcon} /> : <IconFolderOff size={16} className={styles.groupIcon} />}
            <span className={styles.groupText}>
              <span className={styles.groupName}>{group.name}</span>
              {showDisplayPath ? <span className={styles.groupPath}>{group.displayPath}</span> : null}
            </span>
          </UnstyledButton>
          <div className={styles.groupActions}>
            {pinProject && !group.quickChats ? <Tooltip label={group.pinned ? "Unpin project" : "Pin project"}>
              <ActionIcon variant="subtle" color={MANTINE_COLOR.neutral} disabled={pending} aria-label={`${group.pinned ? "Unpin" : "Pin"} ${group.name}`}
                onClick={() => void mutate(() => pinProject(group.key, !group.pinned))}>
                {group.pinned ? <IconPinnedOff size={15} /> : <IconPin size={15} />}
              </ActionIcon>
            </Tooltip> : null}
            {removeProject && !group.quickChats && other.some(item => item.key === group.key) ? (
              <Tooltip label="Remove from project history">
                <ActionIcon variant="subtle" color={MANTINE_COLOR.neutral} disabled={pending}
                  aria-label={`Remove ${group.name} from project history`}
                  onClick={() => void mutate(() => removeProject(group.key))}>
                  <IconTrash size={15} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            <Tooltip label={group.quickChats ? "New chat" : "New session"}>
              <ActionIcon variant="subtle" color={MANTINE_COLOR.neutral} disabled={!group.exists}
                aria-label={`New ${group.quickChats ? "chat" : "session"} in ${group.name}`}
                onClick={() => newSession(group.path)}>
                <IconPlus size={15} />
              </ActionIcon>
            </Tooltip>
          </div>
          <StatusBadge className={styles.groupCount}>{group.activeCount}</StatusBadge>
        </div>
        {open ? sessionList(group) : null}
      </div>
    );
  }

  const content = <>
      {error ? <Alert color="red" mb="sm" role="alert">{error}</Alert> : null}
      <ScrollArea flex={1} style={{ minHeight: 0 }}>
        <Stack gap={2} className={styles.list}>
          {quickChats ? <>{groupRow(quickChats)}<Divider my="xs" /></> : null}
          {pinned.map(groupRow)}
          {pinned.length && recent.length ? <Divider my="xs" /> : null}
          {recent.map(groupRow)}
          {((recent.length > 0 && other.length > 0) || (pinned.length > 0 && other.length > 0 && recent.length === 0)) ? <Divider my="xs" /> : null}
          {other.length ? <>
            <button type="button" className={styles.archivedToggle} aria-expanded={Boolean(expandedArchive.__otherProjects)} onClick={() => setExpandedArchive(value => ({ ...value, __otherProjects: !value.__otherProjects }))}>
              <IconChevronRight size={12} className={expandedArchive.__otherProjects ? styles.groupChevronOpen : undefined} />
              <span>Other projects</span><StatusBadge>{other.length}</StatusBadge>
            </button>
            {expandedArchive.__otherProjects ? other.map(groupRow) : null}
          </> : null}
          {!groups.length ? <div className={styles.empty}>No sessions found yet.</div> : null}
        </Stack>
      </ScrollArea>
      <Button variant="default" leftSection={<IconFolder size={16} />} mt="sm" onClick={() => { onClose(); onOpenFolder(); }}>Open folder</Button>
  </>;

  if (presentation === "sidebar") {
    return opened ? (
      <Box component="nav" aria-label="Projects" data-projects-sidebar ref={sidebarRef}
        pos="fixed" top={96} bottom={0} left={0} p="sm"
        className="flex flex-col"
        style={{ width: "var(--pi-projects-width, 288px)", borderRight: "1px solid var(--mantine-color-default-border)", background: "var(--mantine-color-body)", zIndex: 100 }}
        onFocusCapture={() => { sidebarHadFocus.current = true; }}
        onBlurCapture={event => {
          if (event.relatedTarget) sidebarHadFocus.current = event.currentTarget.contains(event.relatedTarget as Node);
        }}>
        <Group justify="space-between" mb="sm">
          <Text size="sm">Projects</Text>
          <ActionIcon variant="subtle" color={MANTINE_COLOR.neutral} aria-label="Close projects" onClick={onClose}><IconX size={18} /></ActionIcon>
        </Group>
        {content}
      </Box>
    ) : null;
  }
  return <Drawer {...focusReturn} opened={opened} onClose={onClose} title="Projects" size={380}
    closeButtonProps={{ "aria-label": "Close projects" }}
    styles={{
      content: { display: "flex", flexDirection: "column", maxWidth: "100vw" },
      body: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
    }}>
    {content}
  </Drawer>;
});
