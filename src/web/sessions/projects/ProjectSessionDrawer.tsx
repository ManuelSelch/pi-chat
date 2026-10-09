import { Fragment, memo, useMemo, useState } from "react";
import { ActionIcon, Alert, Button, Drawer, Group, Modal, NavLink, ScrollArea, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { MANTINE_COLOR } from "../../ui/theme.js";
import { StatusBadge } from "../../ui/StatusBadge.js";
import { DialogActions } from "../../ui/DialogActions.js";
import { IconChevronDown, IconChevronRight, IconFolder, IconFolderOff, IconGitFork, IconPin, IconPinnedOff, IconPlus } from "@tabler/icons-react";
import type { ChatProjectSummary, ChatSessionSummary, ProjectCatalogue } from "../../../shared/protocol.js";
import { ProjectSessionList } from "./ProjectSessionList.js";

interface ProjectSessionDrawerProps {
  opened: boolean;
  onClose: () => void;
  currentSessionId: string;
  currentProjectPath: string;
  catalogue: ProjectCatalogue;
  /** A run only blocks deleting the session it is writing to; every other
   *  action opens its own tab and is safe to use meanwhile. */
  busy: boolean;
  showDisplayPath: boolean;
  openSession: (path: string) => void;
  newSession: (path?: string) => void;
  deleteSession: (path: string) => void;
  onOpenFolder: () => void;
  archiveSession?: (path: string, archived: boolean) => Promise<void>;
  pinProject?: (path: string, pinned: boolean) => Promise<void>;
  busySessionIds?: readonly string[];
}

interface ProjectGroup {
  key: string;
  name: string;
  primaryProject?: ChatProjectSummary;
  projects: ChatProjectSummary[];
}

function projectGroups(projects: ChatProjectSummary[], currentPath: string, showAll: boolean): ProjectGroup[] {
  // Worktree discovery reports every checkout, including ones Pi has never
  // opened. Keep those in the catalogue for discovery, but do not make empty
  // checkouts compete for space in the projects panel. The primary checkout
  // remains visible when the repository has linked worktrees, so the
  // repository still has a stable "main" entry.
  const visibleProjects = projects.filter((project) => {
    if (project.pinned || project.path === currentPath) return true;
    if (!project.worktree) return showAll || project.sessionCount > 0;
    if (project.sessions.length > 0 && (showAll || project.sessionCount > 0)) return true;
    return project.worktree.primary && projects.some((candidate) => (
      candidate.path !== project.path && candidate.repositoryPath === project.repositoryPath && candidate.worktree && (showAll || candidate.sessionCount > 0 || candidate.path === currentPath)
    ));
  });
  const grouped = new Map<string, ChatProjectSummary[]>();
  const standalone: ChatProjectSummary[] = [];
  for (const project of visibleProjects) {
    if (project.repositoryPath) {
      const entries = grouped.get(project.repositoryPath) ?? [];
      entries.push(project);
      grouped.set(project.repositoryPath, entries);
    } else standalone.push(project);
  }

  const groups: ProjectGroup[] = [];
  for (const [repositoryPath, entries] of grouped) {
    const sorted = [...entries].sort((a, b) => {
      if (a.worktree?.primary !== b.worktree?.primary) return a.worktree?.primary ? -1 : 1;
      return b.modified - a.modified || a.name.localeCompare(b.name);
    });
    // A repository with only one known checkout keeps the original flat row.
    if (sorted.length === 1) standalone.push(sorted[0]!);
    else {
      const primaryProject = sorted.find((project) => project.worktree?.primary) ?? sorted[0]!;
      groups.push({
        key: repositoryPath,
        name: primaryProject.repositoryName ?? primaryProject.name ?? repositoryPath,
        primaryProject,
        projects: sorted.filter((project) => project.path !== primaryProject.path),
      });
    }
  }

  for (const project of standalone) groups.push({ key: project.path, name: project.name, projects: [project] });
  const pinGroup = groups.filter(group => groupPinned(group));
  const regularGroups = groups.filter(group => !groupPinned(group));
  return [...pinGroup.sort((a, b) => a.name.localeCompare(b.name)), ...regularGroups.sort((a, b) => a.name.localeCompare(b.name))];
}

function groupPinned(group: ProjectGroup): boolean {
  return Boolean(group.primaryProject?.pinned) || group.projects.some(project => project.pinned);
}

function groupModified(group: ProjectGroup): number {
  return Math.max(...group.projects.map((project) => project.modified), 0);
}

function checkoutLabel(project: ChatProjectSummary): string {
  if (project.worktree?.branch) return project.worktree.branch;
  if (project.worktree?.detached && project.worktree.commit) return `detached ${project.worktree.commit.slice(0, 7)}`;
  return project.name;
}

export const ProjectSessionDrawer = memo(function ProjectSessionDrawer({ opened, onClose, currentSessionId, currentProjectPath, catalogue, busy, showDisplayPath, openSession, newSession, deleteSession, onOpenFolder, archiveSession, pinProject, busySessionIds = [] }: ProjectSessionDrawerProps) {
  const [selectedProject, setSelectedProject] = useState<string | undefined>();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pendingDelete, setPendingDelete] = useState<ChatSessionSummary | undefined>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const groups = useMemo(() => projectGroups(catalogue.projects, currentProjectPath, false), [catalogue.projects, currentProjectPath]);
  const visibleProjects = groups.flatMap(group => group.projects);
  const activeProject = catalogue.projects.find(project => project.path === selectedProject) ?? catalogue.projects.find(project => project.path === currentProjectPath) ?? visibleProjects[0];
  const pinPath = activeProject?.repositoryPath ?? activeProject?.path;
  const pinned = catalogue.projects.some(project => project.path === pinPath && project.pinned);
  const running = busy ? [...busySessionIds, currentSessionId] : busySessionIds;

  async function mutate(operation: () => Promise<void>, success?: () => void): Promise<void> {
    if (pending) return;
    setPending(true); setError(undefined);
    try { await operation(); success?.(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update project metadata."); }
    finally { setPending(false); }
  }

  function archive(session: ChatSessionSummary, archived: boolean): void {
    if (!archiveSession) return;
    void mutate(() => archiveSession(session.path, archived));
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Projects and sessions"
      size="lg"
      styles={{
        content: { display: "flex", flexDirection: "column" },
        body: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
      }}
    >
      <Modal opened={Boolean(pendingDelete)} onClose={() => setPendingDelete(undefined)} title="Delete session?" centered size="sm">
        <Stack gap="md">
          <Text size="sm">“{pendingDelete?.title}” moves to the trash. An open session closes its tab first.</Text>
          <DialogActions
            cancelLabel="Keep"
            confirmLabel="Delete"
            onCancel={() => setPendingDelete(undefined)}
            onConfirm={() => { deleteSession(pendingDelete!.path); setPendingDelete(undefined); }}
            confirmProps={{ color: MANTINE_COLOR.danger }}
          />
        </Stack>
      </Modal>

      {error ? <Alert color="red" mb="sm" role="alert">{error}</Alert> : null}
      <Group align="stretch" wrap="nowrap" style={{ flex: 1, minHeight: 0 }}>
        <ScrollArea h="100%" flex={1}>
          <Stack gap={4}>
            {groups.map((group, index) => {
              const repoProjects = group.primaryProject ? [group.primaryProject, ...group.projects] : group.projects;
              const nested = Boolean(group.primaryProject) || group.projects.length > 1;
              const open = expanded[group.key] ?? repoProjects.some((project) => project.path === currentProjectPath);
              const count = repoProjects.reduce((total, project) => total + project.sessionCount, 0);
              const current = repoProjects.some((project) => project.path === currentProjectPath);
              const heading = index === 0 || groupPinned(groups[index - 1]!) !== groupPinned(group)
                ? <Text size="xs" c="dimmed" fw={600} mt={index ? "md" : 0} mb={6}>{groupPinned(group) ? "Pinned projects" : "Recent projects"}</Text> : null;
              if (!nested) {
                const project = repoProjects[0]!;
                return (
                  <Fragment key={group.key}>{heading}<NavLink
                    active={project.path === activeProject?.path}
                    label={project.name}
                    leftSection={project.exists ? <IconFolder size={16} /> : <IconFolderOff size={16} />}
                    description={showDisplayPath ? project.displayPath : undefined}
                    rightSection={<Group gap={4} wrap="nowrap">{project.path === currentProjectPath ? <StatusBadge tone="primary">current</StatusBadge> : null}<StatusBadge>{project.sessionCount}</StatusBadge></Group>}
                    onClick={() => setSelectedProject(project.path)}
                  /></Fragment>
                );
              }
              const primaryProject = group.primaryProject ?? repoProjects[0]!;
              return (
                <Stack key={group.key} gap={0}>
                  {heading}<NavLink
                    label={group.name}
                    leftSection={open ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                    rightSection={<Group gap={4} wrap="nowrap">{current ? <StatusBadge tone="primary">current</StatusBadge> : null}<StatusBadge>{count}</StatusBadge></Group>}
                    active={primaryProject.path === activeProject?.path}
                    onClick={() => { setSelectedProject(primaryProject.path); setExpanded((value) => ({ ...value, [group.key]: !open })); }}
                  />
                  {open ? repoProjects.filter((project) => project.path !== primaryProject.path).map((project) => (
                    <NavLink
                      key={project.path}
                      active={project.path === activeProject?.path}
                      label={<Group gap={6} wrap="nowrap">{project.path === currentProjectPath ? <Text component="span" c="blue" size="sm" fw={700} aria-label="current checkout">●</Text> : null}<Text size="sm" truncate>{checkoutLabel(project)}</Text>{project.worktree?.primary ? <StatusBadge>primary</StatusBadge> : null}</Group>}
                      leftSection={<IconGitFork size={16} />}
                      rightSection={<StatusBadge>{project.sessionCount}</StatusBadge>}
                      pl="xl"
                      onClick={() => setSelectedProject(project.path)}
                    />
                  )) : null}
                </Stack>
              );
            })}
            <Button variant="default" leftSection={<IconFolder size={16} />} mb="sm" onClick={() => { onClose(); onOpenFolder(); }}>Open folder</Button>
          </Stack>
        </ScrollArea>
        <ScrollArea h="100%" flex={1}>
          {activeProject ? (
            <Stack gap="xs">
              <Group justify="space-between" wrap="nowrap"><Text fw={650}>{activeProject.name}</Text>{pinProject && pinPath ? <Tooltip label={pinned ? "Unpin project" : "Pin project"}><ActionIcon variant="subtle" color="gray" aria-label={pinned ? "Unpin project" : "Pin project"} disabled={pending || (!activeProject.exists && !pinned)} onClick={() => { void mutate(() => pinProject(pinPath, !pinned)); }}>{pinned ? <IconPinnedOff size={16} /> : <IconPin size={16} />}</ActionIcon></Tooltip> : null}</Group>
              {showDisplayPath ? <Text size="xs" c="dimmed">{activeProject.displayPath}</Text> : null}
              <Button variant="default" leftSection={<IconPlus size={14} />} disabled={!activeProject.exists} onClick={() => { newSession(activeProject.path); onClose(); }}>New session</Button>
              <ProjectSessionList project={activeProject} currentSessionId={currentSessionId} busySessionIds={running} pending={pending}
                openSession={path => { openSession(path); onClose(); }} onDelete={setPendingDelete} onArchive={archiveSession ? archive : undefined} />
            </Stack>
          ) : <Text c="dimmed">No Pi sessions found yet.</Text>}
        </ScrollArea>
      </Group>
    </Drawer>
  );
});
