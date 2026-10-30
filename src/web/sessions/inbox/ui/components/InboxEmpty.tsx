import { Button, Center, Stack, Text } from "@mantine/core";
import { IconLayoutSidebar } from "@tabler/icons-react";

export function InboxEmpty({ hasOpenSessions, onNew }: { hasOpenSessions: boolean; onNew(): void }) {
  return <Center h="100%" p="md"><Stack align="center" gap="sm" maw={440}>
    <IconLayoutSidebar size={38} className="text-[var(--mantine-color-dimmed)]" />
    <Text size="xl">{hasOpenSessions ? "Choose a session." : "You’re all caught up."}</Text>
    <Text size="sm" c="dimmed" ta="center">{hasOpenSessions ? "Select a session in the sidebar to continue. Drafts and running work are unchanged." : "Expand Later to resume a conversation, or start something new."}</Text>
    <Button variant="light" onClick={onNew}>New session</Button>
  </Stack></Center>;
}
