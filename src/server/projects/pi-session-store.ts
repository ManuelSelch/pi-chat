import { execFile } from "node:child_process";
import { existsSync, createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { createInterface } from "node:readline";
import { resolve, sep } from "node:path";
import { promisify } from "node:util";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { SessionNameInfo } from "./catalogue-types.js";

const run = promisify(execFile);

async function moveToTrash(path: string): Promise<void> {
  try {
    await run("trash", [path]);
    return;
  } catch {
    await unlink(path);
  }
}

/** Persistence-specific access to Pi session files. */
export class PiSessionStore {
  constructor(private readonly sessionsRoot = resolve(getAgentDir(), "sessions")) {}

  async delete(sessionPath: string): Promise<void> {
    const target = resolve(sessionPath);
    if (!target.endsWith(".jsonl") || !target.startsWith(this.sessionsRoot + sep)) {
      throw new Error("Refusing to delete a path outside the Pi session folder.");
    }
    if (!existsSync(target)) throw new Error("That session file no longer exists.");
    await moveToTrash(target);
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
