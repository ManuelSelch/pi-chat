import { useState } from "react";
import { Badge, Button, Drawer, Group, NavLink, ScrollArea, Stack, Text } from "@mantine/core";
import type { ChatState } from "./chat-state.js";

interface ProjectSessionDrawerProps {
  opened: boolean;
  onClose: () => void;
  state: ChatState;
  busy: boolean;
  openProject: (path: string) => void;
  openSession: (path: string) => void;
  newSession: (path?: string) => void;
}

export function ProjectSessionDrawer({ opened, onClose, state, busy, openProject, openSession, newSession }: ProjectSessionDrawerProps) {
  const [selectedProject, setSelectedProject] = useState<string | undefined>();
  const activeProject = state.catalogue.projects.find((project) => project.path === (selectedProject ?? state.projectPath)) ?? state.catalogue.projects[0];

  return (
    <Drawer opened={opened} onClose={onClose} title="Projects and sessions" size="lg">
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
                rightSection={<Badge size="xs" variant="light">{project.sessionCount}</Badge>}
                onClick={() => setSelectedProject(project.path)}
              />
            ))}
          </Stack>
        </ScrollArea>
        <ScrollArea h="70vh" flex={1}>
          {activeProject ? (
            <Stack gap="xs">
              <Group justify="space-between" wrap="nowrap">
                <Text fw={650}>{activeProject.name}</Text>
                <Button size="compact-sm" disabled={busy || !activeProject.exists} onClick={() => { openProject(activeProject.path); onClose(); }}>
                  Open latest
                </Button>
              </Group>
              <Button variant="light" disabled={busy || !activeProject.exists} onClick={() => { newSession(activeProject.path); onClose(); }}>
                New session here
              </Button>
              {activeProject.sessions.map((session) => (
                <NavLink
                  key={session.path}
                  active={session.id === state.sessionId}
                  disabled={busy || !activeProject.exists}
                  label={session.title}
                  rightSection={session.nameSource === "none" ? undefined : (
                    <Badge size="xs" variant={session.nameSource === "manual" ? "filled" : "light"} color={session.nameSource === "manual" ? "blue" : "gray"}>
                      {session.nameSource}
                    </Badge>
                  )}
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
