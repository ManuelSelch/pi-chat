import type { ProjectCatalogue } from "../../../shared/protocol.js";

export interface QuickOpenItem {
  kind: "session" | "project" | "worktree";
  /** Session or project path; also the React key. */
  path: string;
  title: string;
  project: string;
  modified: number;
  /** Checkout context, never the session JSONL storage path. */
  projectPath?: string;
  displayPath?: string;
  repositoryPath?: string;
  repositoryName?: string;
  branch?: string;
  detached?: boolean;
  commit?: string;
  messageCount?: number;
  /** A session already held by a tab is focused rather than opened twice. */
  isOpen?: boolean;
}

/** Shared by the palette and the home screen so both age sessions the same way. */
export function relativeTime(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Sessions and checkouts share catalogue metadata; primary checkouts remain projects. */
export function buildQuickOpenItems(catalogue: ProjectCatalogue, openSessionIds: readonly string[]): QuickOpenItem[] {
  const sessions: QuickOpenItem[] = [];
  const projects: QuickOpenItem[] = [];

  for (const project of catalogue.projects) {
    const context = {
      projectPath: project.path,
      displayPath: project.displayPath,
      repositoryPath: project.repositoryPath,
      repositoryName: project.repositoryName,
      branch: project.worktree?.branch,
      detached: project.worktree?.detached,
      commit: project.worktree?.commit,
    };
    projects.push({
      ...context,
      kind: project.worktree && !project.worktree.primary ? "worktree" : "project",
      path: project.path,
      title: project.name,
      project: project.path,
      modified: project.modified,
    });
    for (const session of project.sessions) {
      if (session.archivedAt !== undefined) continue;
      sessions.push({
        ...context,
        kind: "session",
        path: session.path,
        title: session.title,
        project: project.name,
        modified: session.modified,
        messageCount: session.messageCount,
        isOpen: openSessionIds.includes(session.id),
      });
    }
  }

  return [...sessions, ...projects];
}

export interface QuickOpenQuery {
  kind: QuickOpenItem["kind"] | undefined;
  text: string;
}

export function parseQuickOpenQuery(query: string): QuickOpenQuery {
  const text = query.trim().toLowerCase();
  const scopes: Record<string, QuickOpenItem["kind"]> = { "#": "project", "%": "worktree", "@": "session" };
  const kind = scopes[text.charAt(0)];
  return { kind, text: kind ? text.slice(1).trim() : text };
}

/** One insertion, deletion, replacement, or adjacent transposition. */
function isSingleTypo(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let index = 0;
  while (index < Math.min(left.length, right.length) && left[index] === right[index]) index++;
  if (left.length === right.length) {
    return left.slice(index + 1) === right.slice(index + 1)
      || (left[index] === right[index + 1] && left[index + 1] === right[index]
        && left.slice(index + 2) === right.slice(index + 2));
  }
  return left.length > right.length
    ? left.slice(index + 1) === right.slice(index)
    : left.slice(index) === right.slice(index + 1);
}

/** Lower is better: exact, prefix, word prefix, substring, abbreviation, typo. */
function matchScore(value: string, needle: string): number | undefined {
  const text = value.toLowerCase();
  if (text === needle) return 0;
  if (text.startsWith(needle)) return 1;
  const words = text.split(/[\s/_.-]+/);
  if (words.some((word) => word.startsWith(needle))) return 2;
  if (text.includes(needle)) return 3;

  let position = -1;
  let gaps = 0;
  for (const character of needle) {
    const next = text.indexOf(character, position + 1);
    if (next === -1) {
      // Avoid overly broad typo matching for tiny queries.
      return needle.length >= 4 && words.some((word) => isSingleTypo(needle, word)) ? 5 : undefined;
    }
    if (position !== -1) gaps += next - position - 1;
    position = next;
  }
  return 4 + gaps / (text.length + 1);
}

function rank(item: QuickOpenItem, needle: string): number | undefined {
  const primary = [item.title, ...(item.kind === "worktree" ? [item.branch] : [])];
  const context = [item.project, item.projectPath, item.displayPath, item.repositoryName, item.repositoryPath, item.branch];
  const scores = [...primary.map((value) => ({ value, penalty: 0 })), ...context.map((value) => ({ value, penalty: 10 }))]
    .flatMap(({ value, penalty }) => {
      if (!value) return [];
      const score = matchScore(value, needle);
      return score === undefined ? [] : [score + penalty];
    });
  return scores.length ? Math.min(...scores) : undefined;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareItems(left: QuickOpenItem, right: QuickOpenItem): number {
  return right.modified - left.modified
    || compareText(left.title, right.title)
    || compareText(left.kind, right.kind)
    || compareText(left.path, right.path);
}

export function rankQuickOpen(items: readonly QuickOpenItem[], query: string, limit = 20): QuickOpenItem[] {
  const { kind, text } = parseQuickOpenQuery(query);
  const candidates = kind ? items.filter((item) => item.kind === kind) : items;

  // Preserve the existing recent-session view; an empty scope lists that type.
  if (!text) {
    return candidates.filter((item) => kind || item.kind === "session")
      .sort(compareItems).slice(0, limit);
  }

  return candidates
    .map((item) => ({ item, score: rank(item, text) }))
    .filter((entry): entry is { item: QuickOpenItem; score: number } => entry.score !== undefined)
    .sort((left, right) => left.score - right.score || compareItems(left.item, right.item))
    .slice(0, limit)
    .map((entry) => entry.item);
}
