import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

/** Safe failures for core project/session admission, independent of folder browsing. */
export class ProjectPathError extends Error {
  constructor(readonly code: "invalidPath" | "notFound" | "permissionDenied" | "operationFailed", message: string) { super(message); }
}

export async function validateProjectPath(path: string): Promise<string> {
  if (!path || path.includes("\0") || path.length > 4096) throw new ProjectPathError("invalidPath", "Invalid folder path.");
  const expanded = path === "~" ? homedir() : /^~[/\\\\]/.test(path) ? join(homedir(), path.slice(2)) : path;
  if (!isAbsolute(expanded)) throw new ProjectPathError("invalidPath", "Enter an absolute folder path.");
  try {
    const canonical = await realpath(expanded);
    if (!(await stat(canonical)).isDirectory()) throw new ProjectPathError("invalidPath", "The path is not a folder.");
    await access(canonical, constants.R_OK | constants.X_OK);
    return canonical;
  } catch (error) {
    if (error instanceof ProjectPathError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new ProjectPathError("notFound", "Folder not found. It may have moved or been deleted.");
    if (code === "EACCES" || code === "EPERM") throw new ProjectPathError("permissionDenied", "Permission denied for this server folder.");
    if (code === "ENOTDIR") throw new ProjectPathError("invalidPath", "The path is not a folder.");
    throw new ProjectPathError("operationFailed", "Unable to read this server folder.");
  }
}
