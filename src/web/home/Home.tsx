import { useState, type KeyboardEvent } from "react";
import { Badge, Button, Center, Group, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconFolder, IconMessage, IconPlus, IconSearch } from "@tabler/icons-react";
import type { ProjectCatalogue } from "../../shared/protocol.js";
import { buildQuickOpenItems, rankQuickOpen, relativeTime } from "../quickopen/quick-open.js";

interface HomeProps {
  catalogue: ProjectCatalogue;
  onOpenSession: (path: string) => void;
  onOpenProject: (path: string) => void;
  onNewSession: () => void;
}

/**
 * Shown when every tab is closed. It is the quick-open palette without the
 * modal: the same ranking, but always visible, because there is nothing behind
 * it to go back to.
 */
export function Home({ catalogue, onOpenSession, onOpenProject, onNewSession }: HomeProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const hasQuery = query.trim().length > 0;
  // No tab is open, so no session can be marked as already open. Empty home is
  // intentionally quiet; results only appear once the user starts typing.
  const results = hasQuery ? rankQuickOpen(buildQuickOpenItems(catalogue, []), query) : [];
  const clamped = Math.min(active, Math.max(results.length - 1, 0));

  function open(index: number): void {
    const item = results[index];
    if (!item) return;
    if (item.kind === "session") onOpenSession(item.path);
    else onOpenProject(item.path);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => {
        const next = Math.min(current, Math.max(results.length - 1, 0)) + step;
        return (next + results.length) % Math.max(results.length, 1);
      });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (hasQuery) open(clamped);
      else onNewSession();
    }
  }

  return (
    <Center h="100%" px="md">
      <Stack gap="lg" w="100%" maw={620}>
        <Stack gap={4} align="center">
          <Text size="xl" fw={600}>Pi Chat</Text>
          <Text size="sm" c="dimmed">Open a session to start</Text>
        </Stack>

        <Stack gap="sm">
          <TextInput
            autoFocus
            size="md"
            aria-label="Search sessions and projects"
            placeholder="Search sessions and projects"
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(event) => { setQuery(event.currentTarget.value); setActive(0); }}
            onKeyDown={onKeyDown}
          />
          <Button variant="light" leftSection={<IconPlus size={16} />} onClick={onNewSession}>
            New session
          </Button>
        </Stack>

        {hasQuery ? (
          <Stack gap={2} role="listbox" aria-label="Sessions">
            {results.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="md">No matching sessions</Text>
            ) : (
              results.slice(0, 8).map((item, index) => (
              <UnstyledButton
                key={`${item.kind}:${item.path}`}
                role="option"
                aria-selected={index === clamped}
                onMouseEnter={() => setActive(index)}
                onClick={() => open(index)}
                p="xs"
                style={(theme) => ({
                  borderRadius: theme.radius.sm,
                  background: index === clamped ? "var(--mantine-color-default-hover)" : undefined,
                })}
              >
                <Group gap="xs" wrap="nowrap">
                  {item.kind === "session" ? <IconMessage size={16} /> : <IconFolder size={16} />}
                  <Text size="sm" truncate flex={1}>{item.title}</Text>
                  {item.kind === "project" ? <Badge size="xs" variant="light">project</Badge> : null}
                  <Text size="xs" c="dimmed" truncate maw={200}>
                    {item.kind === "session" ? `${item.project} · ${relativeTime(item.modified)}` : "open latest session"}
                  </Text>
                </Group>
              </UnstyledButton>
              ))
            )}
          </Stack>
        ) : null}
      </Stack>
    </Center>
  );
}
