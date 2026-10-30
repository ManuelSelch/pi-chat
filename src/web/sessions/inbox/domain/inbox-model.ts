import type { ProjectCatalogue, Tab, TabStatus } from "../../../app/state/view-types.js";

export interface LaterEntry { path: string; phase: "parking" | "parked" }
export interface InboxRow {
  key: string;
  sessionId?: string;
  path?: string;
  title: string;
  project: string;
  branch?: string;
  modified?: number;
  status: TabStatus;
}
export const INBOX_STATUS_LABEL: Record<TabStatus, string> = { blocked: "Needs you", idle: "Ready", running: "Working" };

export function historyRows(catalogue: ProjectCatalogue): (InboxRow & { path: string })[] {
  return catalogue.projects.flatMap(project => project.sessions.filter(session => session.archivedAt === undefined).map(session => ({
    key: session.path, path: session.path, title: session.title, project: project.name,
    branch: project.worktree?.branch, modified: session.modified, status: "idle" as const,
  })));
}

export function hasSavedSession(catalogue: ProjectCatalogue, path: string | undefined): boolean {
  return path !== undefined && catalogue.projects.some(project => project.sessions.some(session => session.path === path && session.archivedAt === undefined));
}

export function inboxRows(tabs: readonly Tab[], catalogue: ProjectCatalogue): InboxRow[] {
  const history = new Map(historyRows(catalogue).map(row => [row.path, row]));
  return tabs.map(tab => ({
    ...(tab.sessionPath ? history.get(tab.sessionPath) : undefined), key: tab.sessionId, sessionId: tab.sessionId, path: tab.sessionPath && history.has(tab.sessionPath) ? tab.sessionPath : undefined,
    title: tab.title, project: tab.projectName,
    branch: catalogue.projects.find(project => project.path === tab.projectPath)?.worktree?.branch,
    status: tab.status,
  }));
}

export function reconcileLater(entries: readonly LaterEntry[], tabs: readonly Tab[], catalogue: ProjectCatalogue, closingPaths: ReadonlySet<string> = new Set()): LaterEntry[] {
  const history = new Set(historyRows(catalogue).map(row => row.path));
  const open = new Set(tabs.map(tab => tab.sessionPath));
  return entries.flatMap(entry => {
    if (!history.has(entry.path)) return [];
    if (entry.phase === "parking" && closingPaths.has(entry.path)) return [entry];
    return open.has(entry.path) ? [] : [{ ...entry, phase: "parked" as const }];
  });
}

export function matchingRows(rows: readonly InboxRow[], query: string): InboxRow[] {
  const needle = query.trim().toLocaleLowerCase();
  return rows.filter(row => [row.title, row.project, row.branch].some(value => value?.toLocaleLowerCase().includes(needle)));
}
