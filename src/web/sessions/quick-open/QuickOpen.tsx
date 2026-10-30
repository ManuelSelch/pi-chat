import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Group, Modal, ScrollArea, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconBolt, IconClockPause, IconFolder, IconFolderPlus, IconGitBranch } from "@tabler/icons-react";
import { InboxStatus } from "../inbox/ui/components/InboxStatus.js";
import classes from "./QuickOpen.module.css";
import type { ProjectCatalogue, Tab } from "../../app/state/view-types.js";
import { buildQuickOpenItems, folderSearchChoices, parseQuickOpenQuery, rankQuickOpen, type QuickOpenItem } from "./quick-open.js";
import { relativeTime } from "../../ui/relative-time.js";
import { usePointerModality } from "../../ui/usePointerModality.js";
import { useComposerFocusReturn } from "../../ui/focus/composer-focus.js";

import type { SessionAction } from "../actions/session-actions.js";

interface QuickOpenProps {
  opened: boolean;
  onClose: () => void;
  catalogue: ProjectCatalogue;
  tabs: readonly Tab[];
  onOpenSession: (path: string) => void;
  onOpenProject: (path: string) => void;
  onNewSession: (path: string) => void;
  actions?: readonly SessionAction[];
  laterPaths?: ReadonlySet<string>;
}

const resultTypes: Record<QuickOpenItem["kind"], string> = { session: "Session", project: "Folder", worktree: "Worktree", projectAction: "Folder action", action: "Action" };
const resultIcons = { project: IconFolder, worktree: IconGitBranch, projectAction: IconFolderPlus, action: IconBolt } as const;
const iconStyle = { flexShrink: 0, marginTop: 2, color: "var(--mantine-color-dimmed)" } as const;
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
  if (item.kind === "action" || item.kind === "projectAction") return item.project;
  const checkout = item.branch ?? (item.detached ? `detached at ${item.commit?.slice(0, 7) ?? "unknown commit"}` : undefined);
  const project = item.repositoryName ?? item.project;
  if (item.kind === "session") return [project, checkout, relativeTime(item.modified)].filter(Boolean).join(" · ");
  if (item.kind === "worktree") return [item.repositoryName ?? item.repositoryPath, item.detached ? checkout : undefined, item.displayPath ?? item.path].filter(Boolean).join(" · ");
  return item.displayPath ?? item.path;
}

/** Reuses the existing session status indicator and snooze icon for Later. */
function SessionIndicator({ status }: { status: QuickOpenItem["status"] }) {
  if (status === "later") return <IconClockPause size={16} aria-hidden="true" style={iconStyle} />;
  return <span style={{ ...iconStyle, display: "inline-flex", justifyContent: "center", width: 16 }}><InboxStatus status={status ?? "idle"} /></span>;
}

/** Scoped entity search and a small set of existing application actions. */
export function QuickOpen({ opened, onClose, catalogue, tabs, onOpenSession, onOpenProject, onNewSession, actions = [], laterPaths }: QuickOpenProps) {
  const focusReturn = useComposerFocusReturn(opened);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { pointerActive, onPointerMove, reset: resetPointerModality } = usePointerModality();

  const items = buildQuickOpenItems(catalogue, tabs, actions, laterPaths);
  const scopeKind = parseQuickOpenQuery(query).kind;
  const rankedResults = rankQuickOpen(items, query);
  const results = query.trim() ? folderSearchChoices(rankedResults) : rankedResults;
  // Catalogue snapshots can remove results without a query edit.
  const rawActive = Math.min(active, Math.max(0, results.length - 1));
  const selectedIndex = results[rawActive]?.disabled
    ? results.findIndex((item, index) => index > rawActive && !item.disabled) >= 0
      ? results.findIndex((item, index) => index > rawActive && !item.disabled)
      : results.findIndex(item => !item.disabled)
    : rawActive;
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
      resetPointerModality();
    }
  }, [opened, resetPointerModality]);

  useEffect(() => {
    if (!pointerActive) activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active, pointerActive]);

  function choose(item: QuickOpenItem): void {
    if (item.disabled) return;
    if (item.kind === "session") onOpenSession(item.path);
    else if (item.kind === "action") item.action?.run();
    else if (item.kind === "projectAction") {
      if (item.targetPath) onNewSession(item.targetPath);
    } else onOpenProject(item.path);
    onClose();
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      const current = scopes.findIndex((scope) => scope.kind === scopeKind);
      const step = event.shiftKey ? -1 : 1;
      const next = scopes[(current + step + scopes.length) % scopes.length]!;
      const text = scopeKind ? query.trim().slice(1).trimStart() : query.trim();
      setQuery(`${next.prefix}${text}`);
      setActive(0);
      return;
    }
    if (results.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      for (let offset = 1; offset <= results.length; offset++) {
        const next = (selectedIndex + step * offset + results.length * 2) % results.length;
        if (!results[next]!.disabled) { setActive(next); break; }
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(results[selectedIndex]!);
    }
  }

  return (
    <Modal
      {...focusReturn}
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      size="lg"
      padding="xs"
      title={null}
      styles={{ body: { overflowX: "hidden" } }}
    >
      <Stack gap="xs" className={pointerActive ? classes.pointerActive : undefined} style={{ minWidth: 0, overflowX: "hidden" }}>
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
                disabled={item.disabled}
                onPointerMove={(event) => onPointerMove(event, index, selectedIndex, setActive)}
                onClick={() => choose(item)}
                p="8px 12px"
              >
                <Group gap="xs" wrap="nowrap" align="flex-start" style={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
                  {(() => {
                    if (item.kind === "session") return <SessionIndicator status={item.status} />;
                    const Icon = resultIcons[item.kind];
                    return <Icon size={16} aria-hidden="true" style={iconStyle} />;
                  })()}
                  <Stack gap={1} flex={1} style={{ minWidth: 0, overflow: "hidden" }}>
                    <Text size={item.kind === "projectAction" ? "md" : "sm"} truncate>{resultTitle(item)}{item.isOpen ? <Text component="span" size="xs" c="dimmed" ml={6}>Open</Text> : null}</Text>
                    <Text size="xs" c="dimmed" truncate>{resultContext(item)}</Text>
                  </Stack>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        </ScrollArea.Autosize>

        <Text size="xs" c="dimmed" px={10}>Tab to cycle filters · ↑↓ to move · Enter to open · Esc to close</Text>
      </Stack>
    </Modal>
  );
}
