import { existsSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { ProjectMetadataStore } from "./project-metadata-store.js";
import type { ActiveSessionSummary, ChatProjectSummary, ChatSessionSummary, ProjectCatalogue, ProjectSessionLister } from "./catalogue-types.js";
import { formatProjectDisplayPath, formatProjectName } from "./project-display.js";
import { PiSessionStore, readLatestSessionNameInfo } from "./pi-session-store.js";
import { type WorktreeRepository, WorktreeDiscovery } from "./worktree-discovery.js";
export { readLatestSessionNameInfo } from "./pi-session-store.js";
export type { ActiveSessionSummary, ChatProjectSummary, ChatSessionSummary, ProjectCatalogue, ProjectSessionLister } from "./catalogue-types.js";
export { formatProjectDisplayPath, formatProjectName } from "./project-display.js";


async function canonicalPath(path: string): Promise<string> {
  return realpath(path).catch(() => resolve(path));
}

/** The user's home folder is always presented as Quick Chats, never as a
 *  generic project, and is not user-managed. */
export const QUICK_CHATS_NAME = "Quick Chats";

export interface CatalogueOptions {
  metadataOnly?: boolean;
  projectPaths?: readonly string[];
  /** Refresh only these checkouts, reusing saved history even on cold start. */
  checkoutPaths?: readonly string[];
}

export class ProjectSessionService {
  private readonly store: PiSessionStore;
  /** Last disk/worktree scan, before the archive overlay. */
  private scannedProjects?: Map<string, ChatProjectSummary>;
  private discoveryGeneration = 0;
  private readonly repositories = new Map<string, { generation: number; repository: WorktreeRepository }>();

  constructor(
    private readonly lister: ProjectSessionLister = new PiSessionStore(),
    sessionsRoot?: string,
    private readonly discovery: Pick<WorktreeDiscovery, "forDirectory"> = new WorktreeDiscovery(),
    private readonly metadata = new ProjectMetadataStore(sessionsRoot ? resolve(dirname(sessionsRoot), "pi-chat", "projects.json") : undefined),
    private readonly homePath: string | null | undefined = homedir(),
  ) {
    this.store = new PiSessionStore(sessionsRoot);
  }

  async archive(sessionPath: string, archived: boolean): Promise<void> {
    const session = await this.store.describe(sessionPath);
    const cachedProject = this.scannedProjects?.get(await canonicalPath(session.cwd));
    const repository = archived && !cachedProject ? await this.discovery.forDirectory(session.cwd) : undefined;
    const repositoryPath = cachedProject?.repositoryPath ?? repository?.repositoryPath;
    const branch = cachedProject?.worktree?.branch ?? repository?.worktrees.find(worktree => resolve(worktree.path) === session.cwd)?.branch;
    await this.metadata.archive({
      ...session,
      ...(repositoryPath ? { repositoryPath, repositoryName: formatProjectName(repositoryPath) } : {}),
      ...(branch ? { branch } : {}),
    }, archived);
  }

  async restoreIfArchived(sessionPath: string): Promise<void> {
    const data = await this.metadata.read();
    const canonical = await canonicalPath(sessionPath);
    if (!data.archives.some(session => session.path === canonical)) return;
    await this.archive(sessionPath, false);
  }

  async removeProject(projectPath: string): Promise<void> {
    await this.metadata.removeProject(await canonicalPath(projectPath));
  }

  async rememberProject(projectPath: string): Promise<void> {
    await this.metadata.rememberProject(await canonicalPath(projectPath));
  }

  private async scanProjects(projectPaths: readonly string[], active?: ActiveSessionSummary): Promise<Map<string, ChatProjectSummary>> {
    const generation = ++this.discoveryGeneration;
    const sessions = await this.lister.listAll();
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

    for (const path of projectPaths) {
      if (byProject.has(path)) continue;
      byProject.set(path, {
        path, displayPath: formatProjectDisplayPath(path), name: formatProjectName(path),
        exists: existsSync(path), modified: 0, sessionCount: 0, sessions: [],
      });
    }
    if (active) this.includeActiveSession(byProject, active);
    await this.includeRegisteredWorktrees(byProject, generation);
    await this.includeQuickChats(byProject);
    this.scannedProjects = structuredClone(byProject);
    return byProject;
  }

  /** Checkout refreshes reuse saved history; archive/remove reuse the full scan.
   *  Other requests reconcile saved sessions and registered worktrees from disk. */
  async catalogue(active?: ActiveSessionSummary, options: CatalogueOptions = {}): Promise<ProjectCatalogue> {
    const normalizedActive = active ? { ...active, cwd: await canonicalPath(active.cwd), ...(active.path ? { path: await canonicalPath(active.path) } : {}) } : undefined;
    const projectPaths = new Set(await Promise.all((options.projectPaths ?? []).map(canonicalPath)));
    let metadata = await this.metadata.read();
    if (options.checkoutPaths) {
      const generation = ++this.discoveryGeneration;
      await Promise.all(options.checkoutPaths.map(async path => this.discoverRepository(await canonicalPath(path), generation)));
    }
    const cached = options.checkoutPaths ? this.scannedProjects ?? new Map<string, ChatProjectSummary>()
      : options.metadataOnly && [...projectPaths].every(path => this.scannedProjects?.has(path)) ? this.scannedProjects : undefined;
    const byProject = cached ? structuredClone(cached) : await this.scanProjects([...projectPaths], normalizedActive);
    if (options.checkoutPaths) {
      for (const path of projectPaths) {
        if (!byProject.has(path)) byProject.set(path, this.emptyProject(path));
      }
      await this.includeQuickChats(byProject);
      metadata = await this.metadata.read();
    }
    // A scan can overlap an archive write. Overlay fresh metadata, never the
    // state captured before reading all transcripts and discovering worktrees.
    if (!cached) metadata = await this.metadata.read();
    if (cached && normalizedActive) this.includeActiveSession(byProject, normalizedActive);
    this.includeRepositoryMetadata(byProject);
    // Live directories seed discovery but never create synthetic saved sessions.
    // Keep their groups until the last runtime closes.
    const populatedGroups = new Set([...byProject.values()]
      .filter(project => project.sessions.length > 0 || projectPaths.has(project.path))
      .map(project => project.repositoryPath ?? project.path));
    for (const [path, project] of byProject) {
      if (!project.quickChats && !populatedGroups.has(project.repositoryPath ?? path)) byProject.delete(path);
    }
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

    for (const path of metadata.removedProjects) byProject.delete(path);

    const projects = [...byProject.values()]
      .map((project) => ({
        ...project,
        sessions: project.sessions.sort((a, b) => b.modified - a.modified),
      }))
      .sort((a, b) => Number(Boolean(b.quickChats)) - Number(Boolean(a.quickChats)) || b.modified - a.modified);

    return { projects };
  }

  /** Quick Chats is the home folder. It must stay visible with zero sessions
   *  and is never folded into the worktree groups. */
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

  private async discoverRepository(path: string, generation: number): Promise<WorktreeRepository | undefined> {
    const repository = await this.discovery.forDirectory(path);
    if (repository && generation >= (this.repositories.get(repository.repositoryPath)?.generation ?? 0))
      this.repositories.set(repository.repositoryPath, { generation, repository });
    return repository;
  }

  private emptyProject(path: string): ChatProjectSummary {
    return { path, displayPath: formatProjectDisplayPath(path), name: formatProjectName(path),
      exists: existsSync(path), modified: 0, sessionCount: 0, sessions: [] };
  }

  private async includeRegisteredWorktrees(byProject: Map<string, ChatProjectSummary>, generation: number): Promise<void> {
    const checkedPaths = new Set<string>();
    for (const path of byProject.keys()) {
      if (checkedPaths.has(path)) continue;
      const repository = await this.discoverRepository(path, generation);
      if (repository) {
        checkedPaths.add(repository.repositoryPath);
        repository.worktrees.forEach((worktree) => checkedPaths.add(resolve(worktree.path)));
      }
    }

    this.includeRepositoryMetadata(byProject);
  }

  private includeRepositoryMetadata(byProject: Map<string, ChatProjectSummary>): void {
    for (const { repository } of this.repositories.values()) {
      if (!repository.worktrees.some(worktree => byProject.has(resolve(worktree.path)))) continue;
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
