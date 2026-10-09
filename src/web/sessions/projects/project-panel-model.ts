import type { ChatProjectSummary, ChatSessionSummary, ProjectCatalogue } from "../../../shared/protocol.js";

/** One session as it appears inline under its project or worktree row. */
export interface PanelSession {
  session: ChatSessionSummary;
  /** Branch of the checkout the session runs in, when it is a worktree. */
  branch?: string;
  /** The row shows the worktree name instead of the session title. */
  worktreeLabel: boolean;
}

/** A repository, folder, or Quick Chats, with all of its sessions inline. */
export interface PanelGroup {
  key: string;
  name: string;
  /** Path shown in the optional display-path line and the row tooltip. */
  displayPath: string;
  /** Checkout a new session starts in (the primary one for repositories). */
  path: string;
  pinned: boolean;
  exists: boolean;
  quickChats: boolean;
  activeCount: number;
  sessions: PanelSession[];
}

/**
 * Worktree discovery reports every checkout, including ones Pi has never
 * opened. Empty checkouts stay out of the panel, except for the primary
 * checkout of a repository that has another visible checkout. Quick Chats is
 * rendered separately and is never folded into repository grouping.
 */
function isVisibleCheckout(project: ChatProjectSummary, projects: ChatProjectSummary[], currentPath: string): boolean {
  if (project.pinned || project.path === currentPath) return true;
  if (!project.worktree) return project.sessionCount > 0;
  if (project.sessions.length > 0 && project.sessionCount > 0) return true;
  return project.worktree.primary && projects.some(candidate => (
    candidate.path !== project.path
    && candidate.repositoryPath === project.repositoryPath
    && candidate.worktree
    && (candidate.sessionCount > 0 || candidate.path === currentPath)
  ));
}

function groupOf(project: ChatProjectSummary): string {
  return project.repositoryPath ?? project.path;
}

function sessionRow(session: ChatSessionSummary, branch: string | undefined, worktreeLabel: boolean): PanelSession {
  return { session, branch, worktreeLabel };
}

/**
 * Builds the single-column list. Worktree checkouts of one repository become
 * one group: their sessions are merged and each session remembers its branch.
 * When a worktree holds exactly one active session, that session is shown as
 * the worktree (branch) name, because the worktree is what the user navigates
 * by and one session per worktree is the normal workflow.
 */
export function buildPanelGroups(catalogue: ProjectCatalogue, currentPath: string): PanelGroup[] {
  const projects = catalogue.projects;
  const quick = projects.find(project => project.quickChats);

  const byGroup = new Map<string, ChatProjectSummary[]>();
  for (const project of projects) {
    if (project.quickChats || !isVisibleCheckout(project, projects, currentPath)) continue;
    const key = groupOf(project);
    const entries = byGroup.get(key);
    if (entries) entries.push(project);
    else byGroup.set(key, [project]);
  }

  const groups: PanelGroup[] = [];
  for (const [key, checkouts] of byGroup) {
    const sorted = [...checkouts].sort((a, b) => (
      Number(Boolean(b.worktree?.primary)) - Number(Boolean(a.worktree?.primary))
      || b.modified - a.modified
      || a.name.localeCompare(b.name)
    ));
    const primary = sorted.find(project => project.worktree?.primary) ?? sorted[0]!;

    const activePerWorktree = new Map<string, number>();
    for (const checkout of sorted) {
      const branch = checkout.worktree?.branch;
      if (!branch) continue;
      const active = checkout.sessions.filter(session => session.archivedAt === undefined).length;
      activePerWorktree.set(branch, (activePerWorktree.get(branch) ?? 0) + active);
    }

    const sessions: PanelSession[] = [];
    for (const checkout of sorted) {
      const branch = checkout.worktree?.branch;
      // The primary checkout is the project the user opens; only linked
      // worktrees are named after their branch.
      const linkedWorktree = Boolean(checkout.worktree && !checkout.worktree.primary);
      for (const session of checkout.sessions) {
        const worktreeLabel = Boolean(
          linkedWorktree
          && branch
          && session.archivedAt === undefined
          && activePerWorktree.get(branch!) === 1,
        );
        sessions.push(sessionRow(session, branch, worktreeLabel));
      }
    }
    sessions.sort((a, b) => b.session.modified - a.session.modified);

    groups.push({
      key,
      name: primary.repositoryName ?? primary.name,
      displayPath: primary.displayPath,
      path: primary.path,
      pinned: checkouts.some(checkout => checkout.pinned),
      exists: primary.exists,
      quickChats: false,
      activeCount: sessions.filter(entry => entry.session.archivedAt === undefined).length,
      sessions,
    });
  }

  groups.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));

  if (quick) {
    const sessions = quick.sessions
      .map(session => sessionRow(session, undefined, false))
      .sort((a, b) => b.session.modified - a.session.modified);
    groups.unshift({
      key: quick.path,
      name: quick.name,
      displayPath: quick.displayPath,
      path: quick.path,
      pinned: false,
      exists: quick.exists,
      quickChats: true,
      activeCount: sessions.filter(entry => entry.session.archivedAt === undefined).length,
      sessions,
    });
  }

  return groups;
}
