import { execFile } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const GIT_TIMEOUT_MS = 2_000;
const MAX_BUFFER = 1024 * 1024;

export interface ParsedWorktree {
  path: string;
  commit?: string;
  branch?: string;
  detached: boolean;
}

export interface DiscoveredWorktree extends ParsedWorktree {
  primary: boolean;
}

export interface WorktreeRepository {
  repositoryPath: string;
  worktrees: DiscoveredWorktree[];
}

export type GitCommand = (command: string, args: string[]) => Promise<string>;

export function parseWorktreeList(output: string): ParsedWorktree[] {
  const entries: ParsedWorktree[] = [];
  let current: ParsedWorktree | undefined;
  const finish = () => {
    if (current?.path) entries.push(current);
    current = undefined;
  };

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      finish();
      continue;
    }
    const separator = line.indexOf(" ");
    const key = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).trim();
    if (key === "worktree") {
      finish();
      current = { path: value, detached: false };
    } else if (current) {
      if (key === "HEAD") current.commit = value;
      else if (key === "branch") current.branch = value.replace(/^refs\/heads\//, "");
      else if (key === "detached") current.detached = true;
    }
  }
  finish();
  return entries;
}

export class WorktreeDiscovery {
  constructor(private readonly run: GitCommand = runGit) {}

  async forDirectory(directory: string): Promise<WorktreeRepository | undefined> {
    try {
      const commonDirOutput = await this.run("git", ["-C", directory, "rev-parse", "--git-common-dir"]);
      const commonDir = resolve(directory, commonDirOutput.trim());
      const repositoryPath = basename(commonDir) === ".git" ? dirname(commonDir) : commonDir;
      const output = await this.run("git", ["-C", repositoryPath, "worktree", "list", "--porcelain"]);
      const parsed = parseWorktreeList(output);
      if (parsed.length === 0) return undefined;
      const normalizedRepository = canonical(repositoryPath);
      return {
        repositoryPath: normalizedRepository,
        worktrees: parsed.map((worktree, index) => ({
          ...worktree,
          path: canonical(worktree.path),
          primary: index === 0 || canonical(worktree.path) === normalizedRepository,
        })),
      };
    } catch {
      return undefined;
    }
  }
}

async function runGit(command: string, args: string[]): Promise<string> {
  const result = await exec(command, args, { timeout: GIT_TIMEOUT_MS, maxBuffer: MAX_BUFFER, windowsHide: true });
  return result.stdout;
}

function canonical(path: string): string {
  if (!existsSync(path)) return resolve(path);
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}
