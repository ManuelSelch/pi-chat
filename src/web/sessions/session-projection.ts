import type { ChatProjectSummary, ChatSessionSummary, ProjectCatalogue, Tab } from "../app/state/view-types.js";

export interface ProjectedSession {
  tab?: Tab;
  session?: ChatSessionSummary;
  project?: ChatProjectSummary;
}

/** Session paths are compared case-insensitively; retain original paths for operations. */
export const sessionPathKey = (path: string): string => path.toLowerCase();
export const sameSessionPath = (a: string | undefined, b: string | undefined): boolean =>
  a !== undefined && b !== undefined && sessionPathKey(a) === sessionPathKey(b);

/** Join saved history and runtime inventory by path; unsaved runtimes remain distinct. */
export function projectSessions(catalogue: ProjectCatalogue, tabs: readonly Tab[]): ProjectedSession[] {
  const saved = catalogue.projects.flatMap(project => project.sessions.map(session => ({ project, session })));
  const archived = new Set(saved.filter(({ session }) => session.archivedAt !== undefined).map(({ session }) => sessionPathKey(session.path)));
  const byPath = new Map(saved.filter(({ session }) => session.archivedAt === undefined).map(entry => [sessionPathKey(entry.session.path), entry]));
  const loaded = new Set(tabs.flatMap(tab => tab.sessionPath ? [sessionPathKey(tab.sessionPath)] : []));
  const live = tabs.filter(tab => !tab.sessionPath || !archived.has(sessionPathKey(tab.sessionPath))).map(tab => {
    const entry = tab.sessionPath ? byPath.get(sessionPathKey(tab.sessionPath)) : undefined;
    return { tab, session: entry?.session, project: entry?.project ?? catalogue.projects.find(project => project.path === tab.projectPath) };
  });
  return [...live, ...[...byPath.values()].filter(entry => !loaded.has(sessionPathKey(entry.session.path)))];
}
