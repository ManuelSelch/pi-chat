import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Group, Modal, ScrollArea, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconBolt, IconFolder, IconGitBranch, IconMessage } from "@tabler/icons-react";
import classes from "./QuickOpen.module.css";
import type { ProjectCatalogue, Tab } from "../../../shared/protocol.js";
import { buildQuickOpenItems, parseQuickOpenQuery, rankQuickOpen, relativeTime, type QuickOpenAction, type QuickOpenItem } from "./quick-open.js";

interface QuickOpenProps {
  opened: boolean;
  onClose: () => void;
  catalogue: ProjectCatalogue;
  tabs: Tab[];
  onOpenSession: (path: string) => void;
  onOpenProject: (path: string) => void;
  onNewSession?: () => void;
  onOpenFolder?: () => void;
  onOpenSettings?: () => void;
}

const resultTypes = { session: "Session", project: "Folder", worktree: "Worktree", action: "Action" };
const resultIcons = { session: IconMessage, project: IconFolder, worktree: IconGitBranch, action: IconBolt };
const scopes = [
  { prefix: "", label: "All", kind: undefined },
  { prefix: "#", label: "# Folders", kind: "project" },
  { prefix: "%", label: "% Worktrees", kind: "worktree" },
  { prefix: "@", label: "@ Sessions", kind: "session" },
  { prefix: "/", label: "/ Actions", kind: "action" },
] as const;

function resultTitle(item: QuickOpenItem): string {
  return item.kind === "worktree" ? item.branch ?? item.title : item.title;
}

function resultContext(item: QuickOpenItem): string {
  if (item.kind === "action") return item.project;
  const checkout = item.branch ?? (item.detached ? `detached at ${item.commit?.slice(0, 7) ?? "unknown commit"}` : undefined);
  const project = item.repositoryName ?? item.project;
  if (item.kind === "session") return [project, checkout, relativeTime(item.modified)].filter(Boolean).join(" · ");
  if (item.kind === "worktree") return [item.repositoryName ?? item.repositoryPath, item.detached ? checkout : undefined, item.displayPath ?? item.path].filter(Boolean).join(" · ");
  return item.displayPath ?? item.path;
}

/** Scoped entity search and a small set of existing application actions. */
export function QuickOpen({ opened, onClose, catalogue, tabs, onOpenSession, onOpenProject, onNewSession, onOpenFolder, onOpenSettings }: QuickOpenProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const mouseActive = useRef<number | null>(null);

  const actions: QuickOpenAction[] = [];
  if (onNewSession) actions.push({ id: "new-session", title: "New session", description: "Start a session in the current folder" });
  if (onOpenFolder) actions.push({ id: "open-folder", title: "Open folder…", description: "Choose a folder to start a session" });
  if (onOpenSettings) actions.push({ id: "settings", title: "Open settings", description: "Models, appearance and preferences" });
  const actionHandlers = { "new-session": onNewSession, "open-folder": onOpenFolder, settings: onOpenSettings };
  const items = buildQuickOpenItems(catalogue, tabs.map((tab) => tab.sessionId), actions);
  const scopeKind = parseQuickOpenQuery(query).kind;
  const results = rankQuickOpen(items, query);
  // Catalogue snapshots can remove results without a query edit.
  const selectedIndex = Math.min(active, Math.max(0, results.length - 1));
  const emptyText = parseQuickOpenQuery(query).text
    ? `Nothing matches “${query.trim()}”.`
    : scopeKind
      ? `No ${{ session: "sessions", project: "folders", worktree: "worktrees", action: "actions" }[scopeKind]} available.`
      : catalogue.projects.length === 0
        ? "No folders or sessions yet. Open a folder to get started."
        : "No recent sessions. Search or choose a scope.";

  useEffect(() => {
    // Every opening starts fresh, showing the most recent sessions.
    if (opened) {
      setQuery("");
      setActive(0);
    }
  }, [opened]);

  useEffect(() => {
    if (mouseActive.current !== active) activeRef.current?.scrollIntoView({ block: "nearest" });
    mouseActive.current = null;
  }, [active]);

  function choose(item: QuickOpenItem): void {
    if (item.kind === "session") onOpenSession(item.path);
    else if (item.kind === "action") {
      if (item.action) actionHandlers[item.action]?.();
    } else onOpenProject(item.path);
    onClose();
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.nativeEvent.isComposing || results.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((selectedIndex + step + results.length) % results.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(results[selectedIndex]!);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      size="lg"
      padding="xs"
      title={null}
      styles={{ body: { overflowX: "hidden" } }}
    >
      <Stack gap="xs" style={{ minWidth: 0, overflowX: "hidden" }}>
        <TextInput
          ref={inputRef}
          data-autofocus
          aria-label="Search folders, worktrees, sessions and actions"
          placeholder="Search folders, worktrees, sessions and actions…"
          value={query}
          onChange={(event) => { setQuery(event.currentTarget.value); setActive(0); }}
          onKeyDown={keyDown}
          variant="unstyled"
          size="md"
          styles={{ input: { paddingInline: "10px" } }}
        />

        <Group gap={4} px={8} aria-label="Search scopes">
          {scopes.map((scope) => (
            <UnstyledButton key={scope.prefix} className={classes.scope} aria-pressed={scope.kind === scopeKind}
              onClick={() => {
                setQuery(scope.prefix);
                setActive(0);
                inputRef.current?.focus();
              }}>
              {scope.label}
            </UnstyledButton>
          ))}
        </Group>

        <ScrollArea.Autosize
          mah="55vh"
          type="scroll"
          scrollbarSize={6}
          offsetScrollbars="y"
          styles={{ root: { overflowX: "hidden" }, viewport: { overflowX: "hidden", paddingInlineEnd: 8 } }}
        >
          <Stack gap={2} role="listbox" aria-label="Folders, worktrees, sessions and actions" style={{ width: "100%", minWidth: 0, overflowX: "hidden", boxSizing: "border-box" }}>
            {results.length === 0 ? (
              <Text size="sm" c="dimmed" p="8px 12px">{emptyText}</Text>
            ) : null}
            {results.map((item, index) => (
              <UnstyledButton
                key={`${item.kind}:${item.path}`}
                ref={index === selectedIndex ? activeRef : undefined}
                role="option"
                className={classes.row}
                aria-label={`${resultTypes[item.kind]}: ${resultTitle(item)} · ${resultContext(item)}${item.isOpen ? " · Open" : ""}`}
                aria-selected={index === selectedIndex}
                onMouseMove={(event) => {
                  const last = pointer.current;
                  if (last && last.x === event.clientX && last.y === event.clientY) return;
                  pointer.current = { x: event.clientX, y: event.clientY };
                  if (index !== selectedIndex) {
                    mouseActive.current = index;
                    setActive(index);
                  }
                }}
                onClick={() => choose(item)}
                p="8px 12px"
              >
                <Group gap="xs" wrap="nowrap" align="flex-start" style={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
                  {(() => {
                    const Icon = resultIcons[item.kind];
                    return <Icon size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: "var(--mantine-color-dimmed)" }} />;
                  })()}
                  <Stack gap={1} flex={1} style={{ minWidth: 0, overflow: "hidden" }}>
                    <Text size="sm" truncate>{resultTitle(item)}{item.isOpen ? <Text component="span" size="xs" c="dimmed" ml={6}>Open</Text> : null}</Text>
                    <Text size="xs" c="dimmed" truncate>{resultContext(item)}</Text>
                  </Stack>
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
