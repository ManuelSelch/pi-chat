import { execFile } from "node:child_process";

export class GitError extends Error {
  constructor(readonly code: "notRepository" | "invalidBase" | "tooLarge" | "operationFailed", message: string) { super(message); }
}

/** No shell, external diff, textconv, optional writes, prompts or lazy fetching. */
export function runGit(cwd: string, args: string[], allowDifference = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("git", ["--no-pager", "--literal-pathspecs", "-c", "color.ui=false", "-c", "color.diff=false", "-c", "core.quotePath=false", "-c", "diff.relative=false", "-c", "log.showSignature=false", ...args], {
      cwd, encoding: "utf8", timeout: 10000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", GIT_NO_LAZY_FETCH: "1", LC_ALL: "C" },
    }, (error, stdout) => {
      if (!error || (allowDifference && error.code === 1)) return resolve(stdout);
      if (error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") return reject(new GitError("tooLarge", "The comparison is too large to display. Choose a more recent base."));
      reject(new GitError("operationFailed", "Git could not read this comparison. Refresh or choose another base."));
    });
    child.stdin?.end();
  });
}
