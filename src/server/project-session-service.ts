import { execFile } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { createInterface } from "node:readline";
import { basename, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { SessionManager, getAgentDir, type SessionInfo } from "@earendil-works/pi-coding-agent";
import type { SessionNameSource } from "../shared/protocol.js";

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

export interface ChatSessionSummary {
  path: string;
  id: string;
  title: string;
  name?: string;
  nameSource: SessionNameSource;
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
  nameSource?: SessionNameSource;
  cwd: string;
  messageCount: number;
  firstMessage?: string;
}

export interface ProjectSessionLister {
  listAll(sessionDir?: string): Promise<SessionInfo[]>;
}

export interface SessionNameInfo {
  name?: string;
  source: SessionNameSource;
}

export async function readLatestSessionNameInfo(path: string): Promise<SessionNameInfo> {
  let latest: SessionNameInfo = { source: "none" };
  try {
    const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
    for await (const line of lines) {
      let entry: unknown;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (!entry || typeof entry !== "object") continue;
      const value = entry as Record<string, unknown>;
      if (value.type !== "session_info") continue;
      const name = typeof value.name === "string" ? value.name.trim() : "";
      latest = name ? { name, source: value.autoTitle === true ? "auto" : "manual" } : { source: "none" };
    }
  } catch {
    return { source: "none" };
  }
  return latest;
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
        name: basename(projectPath) || projectPath,
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
