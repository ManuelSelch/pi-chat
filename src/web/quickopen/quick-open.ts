import type { ProjectCatalogue } from "../../shared/protocol.js";

export interface QuickOpenItem {
  kind: "session" | "project";
  /** Session or project path; also the React key. */
  path: string;
  title: string;
  project: string;
  modified: number;
  messageCount?: number;
  /** A session already held by a tab is focused rather than opened twice. */
  isOpen?: boolean;
}

/** Sessions first, then projects; both matchable by their own and their project's name. */
export function buildQuickOpenItems(catalogue: ProjectCatalogue, openSessionIds: readonly string[]): QuickOpenItem[] {
  const sessions: QuickOpenItem[] = [];
  const projects: QuickOpenItem[] = [];

  for (const project of catalogue.projects) {
    projects.push({
      kind: "project",
      path: project.path,
      title: project.name,
      project: project.path,
      modified: project.modified,
    });
    for (const session of project.sessions) {
      sessions.push({
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

/**
 * Substring matching rather than fuzzy: for session names, predictable beats
 * clever. The rank only decides ordering, never which items are shown.
 */
function rank(item: QuickOpenItem, needle: string): number | undefined {
  const title = item.title.toLowerCase();
  const project = item.project.toLowerCase();

  if (title.startsWith(needle)) return 0;
  if (title.split(/\s+/).some((word) => word.startsWith(needle))) return 1;
  if (title.includes(needle)) return 2;
  if (project.includes(needle)) return 3;
  return undefined;
}

export function rankQuickOpen(items: readonly QuickOpenItem[], query: string, limit = 20): QuickOpenItem[] {
  const needle = query.trim().toLowerCase();

  // An empty palette is still useful: the most recent sessions are what a
  // reopen usually wants, so no typing is needed at all.
  if (!needle) {
    return [...items]
      .filter((item) => item.kind === "session")
      .sort((left, right) => right.modified - left.modified)
      .slice(0, limit);
  }

  return items
    .map((item) => ({ item, score: rank(item, needle) }))
    .filter((entry): entry is { item: QuickOpenItem; score: number } => entry.score !== undefined)
    .sort((left, right) => {
      // Sessions are the point of the palette; projects are the fallback.
      if (left.item.kind !== right.item.kind) return left.item.kind === "session" ? -1 : 1;
      if (left.score !== right.score) return left.score - right.score;
      return right.item.modified - left.item.modified;
    })
    .slice(0, limit)
    .map((entry) => entry.item);
}
