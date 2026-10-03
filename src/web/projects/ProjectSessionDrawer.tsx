import { useState } from "react";
import { ActionIcon, Button, Drawer, Group, Modal, NavLink, ScrollArea, Stack, Text, Tooltip } from "@mantine/core";
import { MANTINE_COLOR } from "../theme.js";
import { StatusBadge } from "../ui/StatusBadge.js";
import { DialogActions } from "../dialogs/DialogActions.js";
import { IconFolder, IconFolderOff, IconMessage, IconPlus, IconTrash } from "@tabler/icons-react";
import type { ChatSessionSummary, ProjectCatalogue } from "../../shared/protocol.js";
import type { ChatState } from "../chat/chat-state.js";

interface ProjectSessionDrawerProps {
  opened: boolean;
  onClose: () => void;
  state: ChatState;
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

export function ProjectSessionDrawer({ opened, onClose, state, catalogue, busy, showDisplayPath, openSession, newSession, deleteSession, onOpenFolder }: ProjectSessionDrawerProps) {
  const [selectedProject, setSelectedProject] = useState<string | undefined>();
  // Deleting moves a file to the trash, so it is always confirmed first.
  const [pendingDelete, setPendingDelete] = useState<ChatSessionSummary | undefined>();
  const activeProject = catalogue.projects.find((project) => project.path === (selectedProject ?? state.projectPath)) ?? catalogue.projects[0];

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Projects and sessions"
      size="lg"
      // The lists scroll inside the drawer, so the body has to claim the height
      // left over by the header instead of guessing a viewport fraction.
      styles={{
        content: { display: "flex", flexDirection: "column" },
        body: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
      }}
    >
      <Modal
        opened={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(undefined)}
        title="Delete session?"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            “{pendingDelete?.title}” moves to the trash. An open session closes its tab first.
          </Text>
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
            {catalogue.projects.map((project) => (
              <NavLink
                key={project.path}
                // The highlight follows the browsed project, not the running
                // one: clicking a project has to visibly move the selection.
                active={project.path === activeProject?.path}
                disabled={!project.exists}
                label={project.name}
                // description={showDisplayPath ? project.displayPath : undefined}
                leftSection={project.exists ? <IconFolder size={16} /> : <IconFolderOff size={16} />}
                rightSection={
                  <Group gap={4} wrap="nowrap">
                    {project.path === state.projectPath ? <StatusBadge tone="primary">current</StatusBadge> : null}
                    <StatusBadge>{project.sessionCount}</StatusBadge>
                  </Group>
                }
                onClick={() => setSelectedProject(project.path)}
              />
            ))}

            <Button variant="default" leftSection={<IconFolder size={16} />} mb="sm" onClick={() => { onClose(); onOpenFolder(); }}>
              Open folder
            </Button>
          </Stack>
        </ScrollArea>
        <ScrollArea h="100%" flex={1}>
          {activeProject ? (
            <Stack gap="xs">
              <Text fw={650}>{activeProject.name}</Text>
              <Button variant="default" leftSection={<IconPlus size={14} />} disabled={!activeProject.exists} onClick={() => { newSession(activeProject.path); onClose(); }}>
                New session
              </Button>
              {activeProject.sessions.map((session) => (
                <NavLink
                  key={session.path}
                  active={session.id === state.sessionId}
                  disabled={!activeProject.exists}
                  label={session.title}
                  leftSection={<IconMessage size={16} />}
                  rightSection={
                    <Group gap={4} wrap="nowrap">
                      {session.nameSource === "none" ? null : (
                        <StatusBadge variant={session.nameSource === "manual" ? "filled" : "light"} color={session.nameSource === "manual" ? "blue" : "gray"}>
                          {session.nameSource}
                        </StatusBadge>
                      )}
                      <Tooltip label="Delete session">
                        <ActionIcon
                          component="div"
                          role="button"
                          size="sm"
                          variant="subtle"
                          color={MANTINE_COLOR.neutral}
                          disabled={busy && session.id === state.sessionId}
                          aria-label={`Delete ${session.title}`}
                          onClick={(event) => { event.stopPropagation(); setPendingDelete(session); }}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  }
                  description={`${new Date(session.modified).toLocaleString()} · ${session.messageCount} messages`}
                  onClick={() => { openSession(session.path); onClose(); }}
                />
              ))}
            </Stack>
          ) : (
            <Text c="dimmed">No Pi sessions found yet.</Text>
          )}
        </ScrollArea>
      </Group>
    </Drawer>
  );
}
