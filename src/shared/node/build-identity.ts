import { execFileSync } from "node:child_process";

/** Use system Git on macOS/Linux, never PATH. Missing Git yields dev. */
export function chatBuildIdentity(git = (args: string[]) => execFileSync("/usr/bin/git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })): string {
  try {
    if (git(["status", "--porcelain"]).trim()) return "dev";
    return git(["describe", "--tags", "--exact-match", "HEAD"]).trim() || "dev";
  } catch { return "dev"; }
}
