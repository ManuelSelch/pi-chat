import type { ProjectCatalogue, Tab, TabStatus } from "../../../app/state/view-types.js";
import { projectSessions, sameSessionPath, sessionPathKey } from "../../session-projection.js";

export interface LaterEntry { path: string; phase: "parking" | "parked" }
export interface InboxRow {
  key: string;
  sessionId?: string;
  path?: string;
  title: string;
  primaryLabel: string;
  secondaryLabel?: string;
  project: string;
  branch?: string;
  modified?: number;
  status: TabStatus;
}
export const INBOX_STATUS_LABEL: Record<TabStatus, string> = { blocked: "Needs you", idle: "Ready", running: "Working" };

function checkoutConversationCounts(catalogue: ProjectCatalogue, tabs: readonly Tab[]) {
  const archived = new Set(catalogue.projects.flatMap(project => project.sessions.filter(session => session.archivedAt !== undefined).map(session => sessionPathKey(session.path))));
  return new Map(catalogue.projects.map(project => {
    const paths = new Set(project.sessions.filter(session => session.archivedAt === undefined).map(session => sessionPathKey(session.path)));
    const live = tabs.filter(tab => tab.projectPath === project.path && (!tab.sessionPath || !archived.has(sessionPathKey(tab.sessionPath))));
    const unsaved = new Set(live.filter(tab => !tab.sessionPath || !paths.has(sessionPathKey(tab.sessionPath))).map(tab => tab.sessionId));
    return [project.path, paths.size + unsaved.size];
  }));
}

function rowLabels(title: string, worktree: { primary: boolean; branch?: string } | undefined, conversationCount: number) {
  const branch = worktree?.primary === false ? worktree.branch?.trim() || undefined : undefined;
  return { primaryLabel: branch ?? title, secondaryLabel: branch && conversationCount > 1 && branch !== title.trim() && title !== "New session" ? title : undefined };
}

export function historyRows(catalogue: ProjectCatalogue, tabs: readonly Tab[] = []): (InboxRow & { path: string })[] {
  const counts = checkoutConversationCounts(catalogue, tabs);
  return catalogue.projects.flatMap(project => project.sessions.filter(session => session.archivedAt === undefined).map(session => ({
    key: session.path, path: session.path, title: session.title, project: project.repositoryName ?? project.name,
    ...rowLabels(session.title, project.worktree, counts.get(project.path) ?? 0),
    branch: project.worktree?.branch, modified: session.modified, status: "idle" as const,
  })));
}

export function hasSavedSession(catalogue: ProjectCatalogue, path: string | undefined): boolean {
  return path !== undefined && catalogue.projects.some(project => project.sessions.some(session => sameSessionPath(session.path, path) && session.archivedAt === undefined));
}

export function inboxRows(tabs: readonly Tab[], catalogue: ProjectCatalogue, laterPaths: ReadonlySet<string>): InboxRow[] {
  const counts = checkoutConversationCounts(catalogue, tabs);
  const history = new Map(historyRows(catalogue, tabs).map(row => [sessionPathKey(row.path), row]));
  const projected = projectSessions(catalogue, tabs);
  const live: InboxRow[] = projected.filter(entry => entry.tab !== undefined).map(({ tab: runtime, project }) => {
    const tab = runtime!;
    return {
      ...(tab.sessionPath ? history.get(sessionPathKey(tab.sessionPath)) : undefined), key: tab.sessionId, sessionId: tab.sessionId, path: tab.sessionPath ? history.get(sessionPathKey(tab.sessionPath))?.path : undefined,
      title: tab.title, project: project?.repositoryName ?? project?.name ?? tab.projectName,
      ...rowLabels(tab.title, project?.worktree, counts.get(tab.projectPath) ?? 0),
      branch: project?.worktree?.branch,
      status: tab.status,
    };
  });
  const saved = projected.flatMap(({ tab, session }) => !tab && session && ![...laterPaths].some(path => sameSessionPath(path, session.path)) ? [history.get(sessionPathKey(session.path))!] : []);
  return [...live, ...saved]
    .toSorted((a, b) => (b.modified ?? Number.MAX_SAFE_INTEGER) - (a.modified ?? Number.MAX_SAFE_INTEGER));
}

export function reconcileLater(entries: readonly LaterEntry[], tabs: readonly Tab[], catalogue: ProjectCatalogue, closingPaths: ReadonlySet<string> = new Set()): LaterEntry[] {
  const history = new Set(historyRows(catalogue).map(row => sessionPathKey(row.path)));
  const open = new Set(tabs.flatMap(tab => tab.sessionPath ? [sessionPathKey(tab.sessionPath)] : []));
  const closing = new Set([...closingPaths].map(sessionPathKey));
  return entries.flatMap(entry => {
    const key = sessionPathKey(entry.path);
    if (!history.has(key)) return [];
    if (entry.phase === "parking" && closing.has(key)) return [entry];
    return open.has(key) ? [] : [{ ...entry, phase: "parked" as const }];
  });
}
