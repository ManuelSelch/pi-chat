import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { SessionNameInfo } from "./catalogue-types.js";

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
