import { memo, useMemo, useState } from "react";
import { Button, Drawer, Group, Modal, NavLink, ScrollArea, Stack, Text } from "@mantine/core";
import { MANTINE_COLOR } from "../../ui/theme.js";
import { StatusBadge } from "../../ui/StatusBadge.js";
import { DialogActions } from "../../ui/DialogActions.js";
import { IconChevronDown, IconChevronRight, IconFolder, IconFolderOff, IconGitFork, IconPlus } from "@tabler/icons-react";
import type { ChatProjectSummary, ChatSessionSummary, ProjectCatalogue } from "../../../shared/protocol.js";
import { SessionRow } from "./SessionRow.js";

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
}

interface ProjectGroup {
  key: string;
  name: string;
  projects: ChatProjectSummary[];
}

function projectGroups(projects: ChatProjectSummary[]): ProjectGroup[] {
  // Worktree discovery reports every checkout, including ones Pi has never
  // opened. Keep those in the catalogue for discovery, but do not make empty
  // checkouts compete for space in the projects panel. The primary checkout
  // remains visible when the repository has linked worktrees, so the
  // repository still has a stable "main" entry.
  const visibleProjects = projects.filter((project) => {
    if (!project.worktree || project.sessions.length > 0) return true;
    return project.worktree.primary && projects.some((candidate) => (
      candidate.path !== project.path && candidate.repositoryPath === project.repositoryPath && candidate.worktree
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
    else groups.push({ key: repositoryPath, name: sorted[0]?.repositoryName ?? sorted[0]?.name ?? repositoryPath, projects: sorted });
  }

  for (const project of standalone) groups.push({ key: project.path, name: project.name, projects: [project] });
  return groups.sort((a, b) => groupModified(b) - groupModified(a) || a.name.localeCompare(b.name));
}

function groupModified(group: ProjectGroup): number {
  return Math.max(...group.projects.map((project) => project.modified), 0);
}

function checkoutLabel(project: ChatProjectSummary): string {
  if (project.worktree?.branch) return project.worktree.branch;
  if (project.worktree?.detached && project.worktree.commit) return `detached ${project.worktree.commit.slice(0, 7)}`;
  return project.name;
}

export const ProjectSessionDrawer = memo(function ProjectSessionDrawer({ opened, onClose, currentSessionId, currentProjectPath, catalogue, busy, showDisplayPath, openSession, newSession, deleteSession, onOpenFolder }: ProjectSessionDrawerProps) {
  const [selectedProject, setSelectedProject] = useState<string | undefined>();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pendingDelete, setPendingDelete] = useState<ChatSessionSummary | undefined>();
  const groups = useMemo(() => projectGroups(catalogue.projects), [catalogue.projects]);
  const activeProject = catalogue.projects.find((project) => project.path === (selectedProject ?? currentProjectPath)) ?? catalogue.projects[0];

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

      <Group align="stretch" wrap="nowrap" style={{ flex: 1, minHeight: 0 }}>
        <ScrollArea h="100%" flex={1}>
          <Stack gap={4}>
            {groups.map((group) => {
              const nested = group.projects.length > 1;
              const open = expanded[group.key] ?? group.projects.some((project) => project.path === currentProjectPath);
              const count = group.projects.reduce((total, project) => total + project.sessionCount, 0);
              const current = group.projects.some((project) => project.path === currentProjectPath);
              if (!nested) {
                const project = group.projects[0]!;
                return (
                  <NavLink
                    key={group.key}
                    active={project.path === activeProject?.path}
                    disabled={!project.exists}
                    label={project.name}
                    leftSection={project.exists ? <IconFolder size={16} /> : <IconFolderOff size={16} />}
                    description={showDisplayPath ? project.displayPath : undefined}
                    rightSection={<Group gap={4} wrap="nowrap">{project.path === currentProjectPath ? <StatusBadge tone="primary">current</StatusBadge> : null}<StatusBadge>{project.sessionCount}</StatusBadge></Group>}
                    onClick={() => setSelectedProject(project.path)}
                  />
                );
              }
              return (
                <Stack key={group.key} gap={0}>
                  <NavLink
                    label={group.name}
                    leftSection={open ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                    rightSection={<Group gap={4} wrap="nowrap">{current ? <StatusBadge tone="primary">current</StatusBadge> : null}<StatusBadge>{count}</StatusBadge></Group>}
                    onClick={() => setExpanded((value) => ({ ...value, [group.key]: !open }))}
                  />
                  {open ? group.projects.map((project) => (
                    <NavLink
                      key={project.path}
                      active={project.path === activeProject?.path}
                      disabled={!project.exists}
                      label={<Group gap={6} wrap="nowrap">{project.path === currentProjectPath ? <Text component="span" c="blue" size="sm" fw={700} aria-label="current checkout">●</Text> : null}<Text size="sm" truncate>{checkoutLabel(project)}</Text>{project.worktree?.primary ? <StatusBadge>primary</StatusBadge> : null}</Group>}
                      leftSection={project.worktree?.primary ? <IconFolder size={16} /> : <IconGitFork size={16} />}
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
              <Text fw={650}>{activeProject.name}</Text>
              {showDisplayPath ? <Text size="xs" c="dimmed">{activeProject.displayPath}</Text> : null}
              <Button variant="default" leftSection={<IconPlus size={14} />} disabled={!activeProject.exists} onClick={() => { newSession(activeProject.path); onClose(); }}>New session</Button>
              {activeProject.sessions.length === 0 ? <Text c="dimmed" size="sm" mt="sm">No sessions in this checkout yet.</Text> : activeProject.sessions.map((session) => (
                <SessionRow
                  key={session.path}
                  session={session}
                  active={session.id === currentSessionId}
                  disabled={!activeProject.exists}
                  deleteDisabled={busy && session.id === currentSessionId}
                  onOpen={() => { openSession(session.path); onClose(); }}
                  onDelete={() => setPendingDelete(session)}
                />
              ))}
            </Stack>
          ) : <Text c="dimmed">No Pi sessions found yet.</Text>}
        </ScrollArea>
      </Group>
    </Drawer>
  );
});
