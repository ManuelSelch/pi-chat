import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { SessionManager, type SessionInfo } from "@earendil-works/pi-coding-agent";

export interface ChatSessionSummary {
  path: string;
  id: string;
  title: string;
  name?: string;
  firstMessage?: string;
  modified: number;
  created: number;
  messageCount: number;
}

export interface ChatProjectSummary {
  path: string;
  name: string;
  exists: boolean;
  modified: number;
  sessionCount: number;
  sessions: ChatSessionSummary[];
}

export interface ProjectCatalogue {
  projects: ChatProjectSummary[];
}

export interface ActiveSessionSummary {
  path?: string;
  id: string;
  name?: string;
  cwd: string;
  messageCount: number;
  firstMessage?: string;
}

export interface ProjectSessionLister {
  listAll(sessionDir?: string): Promise<SessionInfo[]>;
}

export class ProjectSessionService {
  constructor(private readonly lister: ProjectSessionLister = SessionManager) {}

  async catalogue(active?: ActiveSessionSummary): Promise<ProjectCatalogue> {
    const sessions = await this.lister.listAll();
    const byProject = new Map<string, ChatProjectSummary>();

    for (const session of sessions) {
      const cwd = session.cwd?.trim();
      if (!cwd) continue;
      const projectPath = resolve(cwd);
      const modified = session.modified.getTime();
      let project = byProject.get(projectPath);
      if (!project) {
        project = {
          path: projectPath,
          name: basename(projectPath) || projectPath,
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
        path: session.path,
        id: session.id,
        title: session.name || session.firstMessage || "Untitled session",
        ...(session.name ? { name: session.name } : {}),
        ...(session.firstMessage ? { firstMessage: session.firstMessage } : {}),
        modified,
        created: session.created.getTime(),
        messageCount: session.messageCount,
      });
    }

    if (active) this.includeActiveSession(byProject, active);

    const projects = [...byProject.values()]
      .map((project) => ({
        ...project,
        sessions: project.sessions.sort((a, b) => b.modified - a.modified),
      }))
      .sort((a, b) => b.modified - a.modified);

    return { projects };
  }

  private includeActiveSession(byProject: Map<string, ChatProjectSummary>, active: ActiveSessionSummary): void {
    const projectPath = resolve(active.cwd);
    const sessionPath = active.path ?? active.id;
    let project = byProject.get(projectPath);
    const now = Date.now();
    if (!project) {
      project = {
        path: projectPath,
        name: basename(projectPath) || projectPath,
        exists: existsSync(projectPath),
        modified: now,
        sessionCount: 0,
        sessions: [],
      };
      byProject.set(projectPath, project);
    }
    const title = active.name || active.firstMessage || "New session";
    const existing = project.sessions.find((session) => session.path === sessionPath || session.id === active.id);
    if (existing) {
      existing.title = title;
      if (active.name) existing.name = active.name;
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
      ...(active.firstMessage ? { firstMessage: active.firstMessage } : {}),
      modified: now,
      created: now,
      messageCount: active.messageCount,
    });
  }
}
