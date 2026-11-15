import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Badge, Box, Group, Stack, Text, TextInput, Title, UnstyledButton } from "@mantine/core";
import { THEME } from "../../ui/theme.js";
import { IconFolder, IconMessage, IconSearch } from "@tabler/icons-react";
import type { ProjectCatalogue } from "../../app/state/view-types.js";
import { buildQuickOpenItems, rankQuickOpen } from "../quick-open/quick-open.js";
import { relativeTime } from "../../ui/relative-time.js";
import styles from "./Home.module.css";

interface HomeProps {
  children?: ReactNode;
  catalogue: ProjectCatalogue;
  onOpenSession: (path: string) => void;
  onOpenProject: (path: string) => void;
  onNewSession: () => void;
}

/** Home search shares Quick Switcher ranking; optional activity fills its quiet state. */
export function Home({ children, catalogue, onOpenSession, onOpenProject, onNewSession }: HomeProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const hasQuery = query.trim().length > 0;
  // Search retains existing saved-session/project discovery and ranking.
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
    <div className={styles.page}>
      <Stack gap={22} w="100%" maw={620} mx="auto">
        <Title order={1} size={32} fw={550} ta="center">Lets cook</Title>
        <div>
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
        </div>
      </Stack>
      <Box className={styles.activity}>
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
                  background: index === clamped ? THEME.surface.panelHover : undefined,
                })}
              >
                <Group gap="xs" wrap="nowrap">
                  {item.kind === "session" ? <IconMessage size={16} /> : <IconFolder size={16} />}
                  <Text size="sm" truncate flex={1}>{item.title}</Text>
                  {item.kind === "project" ? <Badge size="xs" variant="light">project</Badge> : null}
                  <Text size="xs" c="dimmed" truncate maw={200}>
                    {item.kind === "session" ? `${item.project} — ${relativeTime(item.modified)}` : "open latest session"}
                  </Text>
                </Group>
              </UnstyledButton>
                ))
              )}
            </Stack>
          ) : children}
      </Box>
    </div>
  );
}
