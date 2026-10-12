import { memo, useMemo, useState } from "react";
import { ActionIcon, Alert, Button, Divider, Drawer, ScrollArea, Stack, Tooltip, UnstyledButton } from "@mantine/core";
import { IconChevronRight, IconFolder, IconFolderOff, IconMessage, IconPin, IconPinnedOff, IconPlus, IconTrash } from "@tabler/icons-react";
import { MANTINE_COLOR } from "../../ui/theme.js";
import { StatusBadge } from "../../ui/StatusBadge.js";
import type { ChatSessionSummary, ProjectCatalogue } from "../../../shared/protocol.js";
import { buildPanelGroups, type PanelGroup, type PanelSession } from "./project-panel-model.js";
import { SessionRow } from "./SessionRow.js";
import styles from "./ProjectSessionDrawer.module.css";

interface ProjectSessionDrawerProps {
  opened: boolean;
  onClose: () => void;
  currentSessionId: string;
  currentProjectPath: string;
  catalogue: ProjectCatalogue;
  /** A run only blocks archiving the session it is writing to; opening and
   *  starting sessions stays safe meanwhile. */
  busy: boolean;
  showDisplayPath: boolean;
  openSession: (path: string) => void;
  newSession: (path?: string) => void;
  onOpenFolder: () => void;
  archiveSession?: (path: string, archived: boolean) => Promise<void>;
  pinProject?: (path: string, pinned: boolean) => Promise<void>;
  removeProject?: (path: string) => Promise<void>;
  busySessionIds?: readonly string[];
}

/** Repository and folder key the current session belongs to. */
function groupKeyForPath(catalogue: ProjectCatalogue, path: string): string | undefined {
  const project = catalogue.projects.find(candidate => candidate.path === path);
  return project ? project.repositoryPath ?? project.path : undefined;
}

export const ProjectSessionDrawer = memo(function ProjectSessionDrawer({ opened, onClose, currentSessionId, currentProjectPath, catalogue, busy, showDisplayPath, openSession, newSession, onOpenFolder, archiveSession, pinProject, removeProject, busySessionIds = [] }: ProjectSessionDrawerProps) {
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
  const recentlyActive = unpinned.filter(group => group.activeCount > 0);
  const recent = recentlyActive.slice(0, 5);
  const other = [
    ...recentlyActive.slice(5),
    ...unpinned.filter(group => group.activeCount === 0),
  ];
  const currentKey = groupKeyForPath(catalogue, currentProjectPath);
  const activeKey = selected ?? currentKey;
  const running = busy ? [...busySessionIds, currentSessionId] : busySessionIds;

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
        active={entry.session.id === currentSessionId} disabled={!group.exists}
        archiveDisabled={pending || running.includes(entry.session.id)}
        onOpen={() => { openSession(entry.session.path); onClose(); }}
        onArchive={archiveSession ? () => archive(entry) : undefined} />
    );
    return (
      <div className={styles.sessions}>
        {active.length ? active.map(row) : <div className={styles.empty}>No sessions yet. Use + to start one.</div>}
        {archived.length ? <>
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
                onClick={() => { newSession(group.path); onClose(); }}>
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

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Projects"
      size={380}
      styles={{
        content: { display: "flex", flexDirection: "column", maxWidth: "100vw" },
        body: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
      }}
    >
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
    </Drawer>
  );
});
