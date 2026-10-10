import { existsSync, createReadStream } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { createInterface } from "node:readline";
import { resolve, sep } from "node:path";
import { SessionManager, getAgentDir, type SessionInfo } from "@earendil-works/pi-coding-agent";
import type { PersistedSessionRecord, SessionNameInfo } from "./catalogue-types.js";

/** Persistence-specific access to Pi session files. */
export class PiSessionStore {
  constructor(private readonly sessionsRoot = resolve(getAgentDir(), "sessions")) {}

  async listAll(): Promise<PersistedSessionRecord[]> {
    const sessions = await SessionManager.listAll();
    return sessions.map((session: SessionInfo) => ({
      path: session.path,
      id: session.id,
      ...(session.cwd !== undefined ? { cwd: session.cwd } : {}),
      ...(session.firstMessage !== undefined ? { firstMessage: session.firstMessage } : {}),
      modified: session.modified,
      created: session.created,
      messageCount: session.messageCount,
    }));
  }

  async validatePath(sessionPath: string): Promise<string> {
    const target = resolve(sessionPath);
    if (!target.endsWith(".jsonl")) {
      throw new Error("Refusing a path outside the Pi session folder.");
    }
    if (!existsSync(target)) throw new Error("That session file no longer exists.");
    const [canonical, root] = await Promise.all([realpath(target), realpath(this.sessionsRoot).catch(() => { throw new Error("Refusing a path outside the Pi session folder."); })]);
    if (!canonical.startsWith(root + sep) || !canonical.endsWith(".jsonl")) {
      throw new Error("Refusing a path outside the Pi session folder.");
    }
    return canonical;
  }

  async describe(sessionPath: string): Promise<{ path: string; id: string; cwd: string }> {
    const path = await this.validatePath(sessionPath);
    const file = await open(path, "r");
    try {
      // Only the header is needed. Do not read a potentially huge transcript.
      const buffer = Buffer.alloc(64 * 1024);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      const header = JSON.parse(buffer.toString("utf8", 0, bytesRead).split("\n")[0]!);
      if (header.type !== "session" || typeof header.id !== "string" || !header.id || typeof header.cwd !== "string" || !header.cwd) {
        throw new Error("Invalid session header.");
      }
      return { path, id: header.id, cwd: resolve(header.cwd) };
    } catch (error) { throw new Error("That file has no valid Pi session header.", { cause: error }); }
    finally { await file.close(); }
  }
}

/** Reads the latest durable session name without exposing SDK JSONL details. */
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
