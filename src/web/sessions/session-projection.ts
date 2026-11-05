import type { ChatProjectSummary, ChatSessionSummary, ProjectCatalogue, Tab } from "../app/state/view-types.js";

export interface ProjectedSession {
  tab?: Tab;
  session?: ChatSessionSummary;
  project?: ChatProjectSummary;
}

/** Join saved history and runtime inventory by path; unsaved runtimes remain distinct. */
export function projectSessions(catalogue: ProjectCatalogue, tabs: readonly Tab[]): ProjectedSession[] {
  const saved = catalogue.projects.flatMap(project => project.sessions.map(session => ({ project, session })));
  const archived = new Set(saved.filter(({ session }) => session.archivedAt !== undefined).map(({ session }) => session.path));
  const byPath = new Map(saved.filter(({ session }) => session.archivedAt === undefined).map(entry => [entry.session.path, entry]));
  const loaded = new Set(tabs.flatMap(tab => tab.sessionPath ? [tab.sessionPath] : []));
  const live = tabs.filter(tab => !tab.sessionPath || !archived.has(tab.sessionPath)).map(tab => {
    const entry = tab.sessionPath ? byPath.get(tab.sessionPath) : undefined;
    return { tab, session: entry?.session, project: entry?.project ?? catalogue.projects.find(project => project.path === tab.projectPath) };
  });
  return [...live, ...[...byPath.values()].filter(entry => !loaded.has(entry.session.path))];
}
