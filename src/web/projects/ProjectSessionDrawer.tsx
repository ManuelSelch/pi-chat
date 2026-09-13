import { useState } from "react";
import { ActionIcon, Badge, Button, Drawer, Group, Modal, NavLink, ScrollArea, Stack, Text, Tooltip } from "@mantine/core";
import { IconFolder, IconFolderOff, IconMessage, IconPlus, IconTrash } from "@tabler/icons-react";
import type { ChatSessionSummary } from "../../shared/protocol.js";
import type { ChatState } from "../chat/chat-state.js";

interface ProjectSessionDrawerProps {
  opened: boolean;
  onClose: () => void;
  state: ChatState;
  busy: boolean;
  openSession: (path: string) => void;
  newSession: (path?: string) => void;
  deleteSession: (path: string) => void;
}

export function ProjectSessionDrawer({ opened, onClose, state, busy, openSession, newSession, deleteSession }: ProjectSessionDrawerProps) {
  const [selectedProject, setSelectedProject] = useState<string | undefined>();
  // Deleting moves a file to the trash, so it is always confirmed first.
  const [pendingDelete, setPendingDelete] = useState<ChatSessionSummary | undefined>();
  const activeProject = state.catalogue.projects.find((project) => project.path === (selectedProject ?? state.projectPath)) ?? state.catalogue.projects[0];

  return (
    <Drawer opened={opened} onClose={onClose} title="Projects and sessions" size="lg">
      <Modal
        opened={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(undefined)}
        title="Delete session?"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            “{pendingDelete?.title}” moves to the trash. Open sessions must be closed first.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setPendingDelete(undefined)}>Keep</Button>
            <Button color="red" onClick={() => { deleteSession(pendingDelete!.path); setPendingDelete(undefined); }}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Group align="flex-start" wrap="nowrap">
        <ScrollArea h="70vh" flex={1}>
          <Stack gap={4}>
            {state.catalogue.projects.map((project) => (
              <NavLink
                key={project.path}
                active={project.path === state.projectPath}
                disabled={!project.exists || busy}
                label={project.name}
                description={project.path}
                leftSection={project.exists ? <IconFolder size={16} /> : <IconFolderOff size={16} />}
                rightSection={<Badge size="xs" variant="light">{project.sessionCount}</Badge>}
                onClick={() => setSelectedProject(project.path)}
              />
            ))}
          </Stack>
        </ScrollArea>
        <ScrollArea h="70vh" flex={1}>
          {activeProject ? (
            <Stack gap="xs">
              <Text fw={650}>{activeProject.name}</Text>
              <Button variant="light" leftSection={<IconPlus size={14} />} disabled={busy || !activeProject.exists} onClick={() => { newSession(activeProject.path); onClose(); }}>
                New session here
              </Button>
              {activeProject.sessions.map((session) => (
                <NavLink
                  key={session.path}
                  active={session.id === state.sessionId}
                  disabled={busy || !activeProject.exists}
                  label={session.title}
                  leftSection={<IconMessage size={16} />}
                  rightSection={
                    <Group gap={4} wrap="nowrap">
                      {session.nameSource === "none" ? null : (
                        <Badge size="xs" variant={session.nameSource === "manual" ? "filled" : "light"} color={session.nameSource === "manual" ? "blue" : "gray"}>
                          {session.nameSource}
                        </Badge>
                      )}
                      <Tooltip label="Delete session">
                        <ActionIcon
                          component="div"
                          role="button"
                          size="sm"
                          variant="subtle"
                          color="gray"
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
