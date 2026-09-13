import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Badge, Group, Modal, ScrollArea, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconFolder, IconMessage } from "@tabler/icons-react";
import type { ProjectCatalogue, Tab } from "../../shared/protocol.js";
import { buildQuickOpenItems, rankQuickOpen, relativeTime, type QuickOpenItem } from "./quick-open.js";

interface QuickOpenProps {
  opened: boolean;
  onClose: () => void;
  catalogue: ProjectCatalogue;
  tabs: Tab[];
  onOpenSession: (path: string) => void;
  onOpenProject: (path: string) => void;
}

/** Type-to-open palette: one query matches a session title or its project. */
export function QuickOpen({ opened, onClose, catalogue, tabs, onOpenSession, onOpenProject }: QuickOpenProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const items = buildQuickOpenItems(catalogue, tabs.map((tab) => tab.sessionId));
  const results = rankQuickOpen(items, query);

  useEffect(() => {
    // Every opening starts fresh, showing the most recent sessions.
    if (opened) {
      setQuery("");
      setActive(0);
    }
  }, [opened]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(item: QuickOpenItem): void {
    if (item.kind === "session") onOpenSession(item.path);
    else onOpenProject(item.path);
    onClose();
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (results.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + results.length) % results.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]!);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} withCloseButton={false} size="lg" padding="xs" title={null}>
      <Stack gap="xs">
        <TextInput
          data-autofocus
          aria-label="Search sessions and projects"
          placeholder="Search sessions and projects…"
          value={query}
          onChange={(event) => { setQuery(event.currentTarget.value); setActive(0); }}
          onKeyDown={keyDown}
          variant="unstyled"
          size="md"
          styles={{ input: { paddingInline: "10px" } }}
        />

        <ScrollArea.Autosize mah="55vh">
          <Stack gap={2} role="listbox" aria-label="Sessions and projects">
            {results.length === 0 ? (
              <Text size="sm" c="dimmed" p="8px 12px">Nothing matches “{query.trim()}”.</Text>
            ) : null}
            {results.map((item, index) => (
              <UnstyledButton
                key={`${item.kind}:${item.path}`}
                ref={index === active ? activeRef : undefined}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
                p="8px 12px"
                style={{
                  borderRadius: "var(--mantine-radius-sm)",
                  background: index === active ? "var(--mantine-color-default-hover)" : undefined,
                }}
              >
                <Group gap="xs" wrap="nowrap">
                  {item.kind === "session" ? <IconMessage size={16} /> : <IconFolder size={16} />}
                  <Text size="sm" truncate flex={1}>{item.title}</Text>
                  {item.isOpen ? <Badge size="xs" variant="light">open</Badge> : null}
                  <Text size="xs" c="dimmed" truncate maw={180}>
                    {item.kind === "session"
                      ? `${item.project} · ${relativeTime(item.modified)}`
                      : "open latest session"}
                  </Text>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        </ScrollArea.Autosize>

        <Text size="xs" c="dimmed" px={10}>↑↓ to move · Enter to open · Esc to close</Text>
      </Stack>
    </Modal>
  );
}
