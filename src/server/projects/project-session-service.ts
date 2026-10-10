import { existsSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { ProjectMetadataStore } from "./project-metadata-store.js";
import type { ActiveSessionSummary, ChatProjectSummary, ChatSessionSummary, ProjectCatalogue, ProjectSessionLister } from "./catalogue-types.js";
import { formatProjectDisplayPath, formatProjectName } from "./project-display.js";
import { PiSessionStore, readLatestSessionNameInfo } from "./pi-session-store.js";
import { WorktreeDiscovery } from "./worktree-discovery.js";
export { readLatestSessionNameInfo } from "./pi-session-store.js";
export type { ActiveSessionSummary, ChatProjectSummary, ChatSessionSummary, ProjectCatalogue, ProjectSessionLister } from "./catalogue-types.js";
export { formatProjectDisplayPath, formatProjectName } from "./project-display.js";


async function canonicalPath(path: string): Promise<string> {
  return realpath(path).catch(() => resolve(path));
}

/** The user's home folder is always presented as Quick Chats, never as a
 *  generic project, and is not user-managed. */
export const QUICK_CHATS_NAME = "Quick Chats";

export class ProjectSessionService {
  private readonly store: PiSessionStore;

  constructor(
    private readonly lister: ProjectSessionLister = new PiSessionStore(),
    sessionsRoot?: string,
    private readonly discovery: Pick<WorktreeDiscovery, "forDirectory"> = new WorktreeDiscovery(),
    private readonly metadata = new ProjectMetadataStore(sessionsRoot ? resolve(dirname(sessionsRoot), "pi-chat", "projects.json") : undefined),
    private readonly homePath: string | undefined = homedir(),
  ) {
    this.store = new PiSessionStore(sessionsRoot);
  }

  async archive(sessionPath: string, archived: boolean): Promise<void> {
    const session = await this.store.describe(sessionPath);
    const repository = archived ? await this.discovery.forDirectory(session.cwd) : undefined;
    const checkout = repository?.worktrees.find(worktree => resolve(worktree.path) === session.cwd);
    await this.metadata.archive({
      ...session,
      ...(repository ? { repositoryPath: repository.repositoryPath, repositoryName: formatProjectName(repository.repositoryPath) } : {}),
      ...(checkout?.branch ? { branch: checkout.branch } : {}),
    }, archived);
  }

  async restoreIfArchived(sessionPath: string): Promise<void> {
    const data = await this.metadata.read();
    const canonical = await canonicalPath(sessionPath);
    if (!data.archives.some(session => session.path === canonical)) return;
    await this.archive(sessionPath, false);
  }

  async pin(projectPath: string, pinned: boolean): Promise<void> {
    let path = pinned ? await realpath(projectPath) : await canonicalPath(projectPath);
    const repository = await this.discovery.forDirectory(path);
    if (repository) {
      const checkouts = await Promise.all(repository.worktrees.map(worktree => canonicalPath(worktree.path)));
      if (checkouts.includes(path)) path = await canonicalPath(repository.repositoryPath);
    }
    await this.metadata.pin(path, pinned);
  }

  async catalogue(active?: ActiveSessionSummary): Promise<ProjectCatalogue> {
    const [sessions, metadata] = await Promise.all([this.lister.listAll(), this.metadata.read()]);
    const byProject = new Map<string, ChatProjectSummary>();

    for (const session of sessions) {
      const nameInfo = await readLatestSessionNameInfo(session.path);
      const cwd = session.cwd?.trim();
      if (!cwd) continue;
      const projectPath = await canonicalPath(cwd);
      const modified = session.modified.getTime();
      let project = byProject.get(projectPath);
      if (!project) {
        project = {
          path: projectPath,
          displayPath: formatProjectDisplayPath(projectPath),
          name: formatProjectName(projectPath),
          exists: existsSync(projectPath),
          modified,
          sessionCount: 0,
          sessions: [],
        };
        byProject.set(projectPath, project);
      }
      project.modified = Math.max(project.modified, modified);
      project.sessionCount += 1;
      project.sessions.push({
        path: await canonicalPath(session.path),
        id: session.id,
        title: nameInfo.name || session.firstMessage || "Untitled session",
        ...(nameInfo.name ? { name: nameInfo.name } : {}),
        nameSource: nameInfo.source,
        ...(session.firstMessage ? { firstMessage: session.firstMessage } : {}),
        modified,
        created: session.created.getTime(),
        messageCount: session.messageCount,
      });
    }

    if (active) this.includeActiveSession(byProject, { ...active, cwd: await canonicalPath(active.cwd), ...(active.path ? { path: await canonicalPath(active.path) } : {}) });
    for (const path of metadata.pins) {
      const project = byProject.get(path) ?? {
        path, displayPath: formatProjectDisplayPath(path), name: formatProjectName(path),
        exists: existsSync(path), modified: 0, sessionCount: 0, sessions: [],
      };
      project.pinned = true;
      byProject.set(path, project);
    }
    await this.includeRegisteredWorktrees(byProject);
    await this.includeQuickChats(byProject);
    const archived = new Map(metadata.archives.map(session => [`${session.path}\0${session.id}`, session]));
    for (const project of byProject.values()) {
      for (const session of project.sessions) {
        const record = archived.get(`${resolve(session.path)}\0${session.id}`);
        if (!record) continue;
        session.archivedAt = record.archivedAt;
        if (!project.repositoryPath && record.repositoryPath) {
          project.repositoryPath = record.repositoryPath;
          project.repositoryName = record.repositoryName;
          project.worktree = { detached: false, primary: project.path === record.repositoryPath, ...(record.branch ? { branch: record.branch } : {}) };
        }
      }
      project.sessionCount = project.sessions.filter(session => session.archivedAt === undefined).length;
    }

    const projects = [...byProject.values()]
      .map((project) => ({
        ...project,
        sessions: project.sessions.sort((a, b) => b.modified - a.modified),
      }))
      .sort((a, b) => Number(Boolean(b.quickChats)) - Number(Boolean(a.quickChats)) || Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.modified - a.modified);

    return { projects };
  }

  /** Quick Chats is the home folder. It must stay visible with zero sessions
   *  and is never folded into the pin or worktree groups. */
  private async includeQuickChats(byProject: Map<string, ChatProjectSummary>): Promise<void> {
    if (!this.homePath) return;
    const path = await canonicalPath(this.homePath);
    const project = byProject.get(path) ?? {
      path,
      displayPath: formatProjectDisplayPath(path, path),
      name: QUICK_CHATS_NAME,
      exists: existsSync(path),
      modified: 0,
      sessionCount: 0,
      sessions: [],
    };
    project.quickChats = true;
    project.name = QUICK_CHATS_NAME;
    project.displayPath = formatProjectDisplayPath(path, path);
    byProject.set(path, project);
  }

  private async includeRegisteredWorktrees(byProject: Map<string, ChatProjectSummary>): Promise<void> {
    const repositories = new Map<string, Awaited<ReturnType<WorktreeDiscovery["forDirectory"]>>>();
    const checkedPaths = new Set<string>();
    for (const path of byProject.keys()) {
      if (checkedPaths.has(path)) continue;
      const repository = await this.discovery.forDirectory(path);
      if (repository) {
        repositories.set(repository.repositoryPath, repository);
        checkedPaths.add(repository.repositoryPath);
        repository.worktrees.forEach((worktree) => checkedPaths.add(resolve(worktree.path)));
      }
    }

    for (const repository of repositories.values()) {
      if (!repository) continue;
      for (const worktree of repository.worktrees) {
        const projectPath = resolve(worktree.path);
        let project = byProject.get(projectPath);
        if (!project) {
          project = {
            path: projectPath,
            displayPath: formatProjectDisplayPath(projectPath),
            name: formatProjectName(projectPath),
            exists: existsSync(projectPath),
            modified: 0,
            sessionCount: 0,
            sessions: [],
          };
          byProject.set(projectPath, project);
        }
        project.repositoryPath = repository.repositoryPath;
        project.repositoryName = formatProjectName(repository.repositoryPath);
        project.worktree = {
          ...(worktree.branch ? { branch: worktree.branch } : {}),
          ...(worktree.commit ? { commit: worktree.commit } : {}),
          detached: worktree.detached,
          primary: worktree.primary,
        };
      }
    }
  }

  private includeActiveSession(byProject: Map<string, ChatProjectSummary>, active: ActiveSessionSummary): void {
    const projectPath = resolve(active.cwd);
    const sessionPath = active.path ?? active.id;
    let project = byProject.get(projectPath);
    const now = Date.now();
    if (!project) {
      project = {
        path: projectPath,
        displayPath: formatProjectDisplayPath(projectPath),
        name: formatProjectName(projectPath),
        exists: existsSync(projectPath),
        modified: now,
        sessionCount: 0,
        sessions: [],
      };
      byProject.set(projectPath, project);
    }
    const nameSource = active.nameSource ?? (active.name ? "manual" : "none");
    const title = active.name || active.firstMessage || "New session";
    const existing = project.sessions.find((session) => session.path === sessionPath || session.id === active.id);
    if (existing) {
      existing.title = title;
      if (active.name) existing.name = active.name;
      existing.nameSource = nameSource;
      existing.messageCount = active.messageCount;
      return;
    }
    project.sessionCount += 1;
    project.modified = Math.max(project.modified, now);
    project.sessions.unshift({
      path: sessionPath,
      id: active.id,
      title,
      ...(active.name ? { name: active.name } : {}),
      nameSource,
      ...(active.firstMessage ? { firstMessage: active.firstMessage } : {}),
      modified: now,
      created: now,
      messageCount: active.messageCount,
    });
  }
}
