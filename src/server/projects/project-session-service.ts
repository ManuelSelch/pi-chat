import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { promisify } from "node:util";
import { SessionManager, getAgentDir } from "@earendil-works/pi-coding-agent";
import type { ActiveSessionSummary, ChatProjectSummary, ChatSessionSummary, ProjectCatalogue, ProjectSessionLister } from "./catalogue-types.js";
import { formatProjectDisplayPath, formatProjectName } from "./project-display.js";
import { readLatestSessionNameInfo } from "./pi-session-store.js";
export { readLatestSessionNameInfo } from "./pi-session-store.js";
export type { ActiveSessionSummary, ChatProjectSummary, ChatSessionSummary, ProjectCatalogue, ProjectSessionLister } from "./catalogue-types.js";
export { formatProjectDisplayPath, formatProjectName } from "./project-display.js";

const run = promisify(execFile);

/**
 * Recoverable delete, matching Pi's own session picker: a mistaken click should
 * be undoable from the Trash rather than gone for good.
 */
async function moveToTrash(path: string): Promise<void> {
  try {
    await run("trash", [path]);
    return;
  } catch {
    // No `trash` binary (or it refused); a plain unlink still has to work.
    await unlink(path);
  }
}


export class ProjectSessionService {
  constructor(
    private readonly lister: ProjectSessionLister = SessionManager,
    private readonly sessionsRoot = resolve(getAgentDir(), "sessions"),
  ) {}

  /**
   * Deletes one session file. The path arrives from the browser, so it is
   * checked against the Pi session folder instead of being trusted.
   */
  async delete(sessionPath: string): Promise<void> {
    const target = resolve(sessionPath);
    if (!target.endsWith(".jsonl") || !target.startsWith(this.sessionsRoot + sep)) {
      throw new Error("Refusing to delete a path outside the Pi session folder.");
    }
    if (!existsSync(target)) throw new Error("That session file no longer exists.");
    await moveToTrash(target);
  }

  async catalogue(active?: ActiveSessionSummary): Promise<ProjectCatalogue> {
    const sessions = await this.lister.listAll();
    const byProject = new Map<string, ChatProjectSummary>();

    for (const session of sessions) {
      const nameInfo = await readLatestSessionNameInfo(session.path);
      const cwd = session.cwd?.trim();
      if (!cwd) continue;
      const projectPath = resolve(cwd);
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
        path: session.path,
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
