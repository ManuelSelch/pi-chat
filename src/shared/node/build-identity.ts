import { execFileSync } from "node:child_process";

/** Release tags describe only clean, exactly tagged source trees. */
export function chatBuildIdentity(git = (args: string[]) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })): string {
  try {
    if (git(["status", "--porcelain"]).trim()) return "dev";
    return git(["describe", "--tags", "--exact-match", "HEAD"]).trim() || "dev";
  } catch { return "dev"; }
}
