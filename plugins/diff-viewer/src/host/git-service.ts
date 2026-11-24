import { constants } from "node:fs";
import { lstat, open, readlink, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { ChangedFile, CommitPage, Comparison, DiffSnapshot, RepositoryContext } from "../contract.js";
import { parsePatch } from "../domain/parse-patch.js";
import { GitError, runGit } from "./git-command.js";

const MAX_FILES = 200;
const MAX_BYTES = 2 * 1024 * 1024;

export class GitService {
  private async root(path: string): Promise<string> {
    if (!isAbsolute(path)) throw new GitError("notRepository", "Open a project with an absolute server folder path.");
    try {
      const cwd = await realpath(path);
      return (await runGit(cwd, ["rev-parse", "--show-toplevel"])).trim();
    } catch {
      throw new GitError("notRepository", "This project is not an accessible Git working tree.");
    }
  }
  private async branch(root: string): Promise<string> {
    try { return (await runGit(root, ["symbolic-ref", "--quiet", "--short", "HEAD"])).trim(); }
    catch { return "Detached HEAD"; }
  }
  private async resolveCommit(root: string, ref: string): Promise<string> {
    try {
      const sha = (await runGit(root, ["rev-parse", "--verify", "--end-of-options", ref + "^{commit}"])).trim();
      if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha)) throw new Error();
      return sha;
    } catch { throw new GitError("invalidBase", "The selected base is no longer available. Choose another branch or commit."); }
  }
  async context(projectPath: string): Promise<RepositoryContext> {
    const root = await this.root(projectPath);
    const [branch, refs] = await Promise.all([
      this.branch(root), runGit(root, ["for-each-ref", "--sort=refname", "--format=%(refname)%09%(refname:short)%09%(symref)%09%(objectname)", "refs/heads/", "refs/remotes/"]),
    ]);
    const entries = refs.split("\n").filter(Boolean).map(line=>{
      const [ref="",name="",symbolic="",sha=""] = line.split("\t");
      return {ref,name,symbolic,sha,remote:ref.startsWith("refs/remotes/")};
    });
    const local = entries.filter(entry=>!entry.remote);
    const branches = entries.filter(entry=>!entry.symbolic &&
      !(entry.remote && local.some(candidate=>entry.ref.slice("refs/remotes/".length).split("/").slice(1).join("/")===candidate.name && candidate.sha===entry.sha)));
    const detected = entries.find(entry=>entry.ref==="refs/remotes/origin/HEAD")?.symbolic ?? entries.find(entry=>entry.symbolic)?.symbolic;
    const remoteDefault = entries.find(entry=>entry.ref===detected);
    const matchingLocal = remoteDefault && local.find(entry=>entry.name===remoteDefault.ref.slice("refs/remotes/".length).split("/").slice(1).join("/"));
    const defaultRef = matchingLocal?.ref ?? remoteDefault?.ref ??
      ["refs/heads/main","refs/remotes/origin/main","refs/heads/master","refs/remotes/origin/master"].find(ref=>branches.some(entry=>entry.ref===ref));
    const defaultBranch = branches.find(entry=>entry.ref===defaultRef)?.ref ?? null;
    let merged = new Set<string>();
    try { merged = new Set((await runGit(root,["for-each-ref","--merged=HEAD","--format=%(refname)","refs/heads/"])).trim().split("\n")); }
    catch { /* Unborn repositories have no ancestry to suggest. */ }
    const head = local.find(entry=>entry.ref==="refs/heads/"+branch)?.sha;
    const defaultTip = branches.find(entry=>entry.ref===defaultBranch)?.sha;
    const ranked: {ref:string;distance:number}[] = [];
    for (const entry of branches) {
      if (entry.remote || entry.sha===defaultTip || entry.sha===head || !merged.has(entry.ref)) continue;
      const distance = Number((await runGit(root,["rev-list","--count",entry.ref+"..HEAD"])).trim());
      ranked.push({ref:entry.ref,distance});
    }
    const suggestedBranches = ranked.sort((a,b)=>a.distance-b.distance || a.ref.localeCompare(b.ref)).slice(0,2).map(entry=>entry.ref);
    return {branch,defaultBranch,suggestedBranches,branches:branches.map(({ref,name,remote})=>({ref,name,remote}))};
  }
  async commits(projectPath: string): Promise<CommitPage> {
    const root = await this.root(projectPath);
    try { await this.resolveCommit(root, "HEAD"); }
    catch { return { commits: [] }; }
    const output = await runGit(root, ["log", "--no-show-signature", "--format=%H%x00%s%x00%an%x00%aI", "-z", "--max-count=5", "HEAD", "--"]);
    const fields = output.split("\0");
    const commits: CommitPage["commits"] = [];
    for (let index = 0; index + 3 < fields.length; index += 4) {
      const [sha, subject, author, date] = fields.slice(index, index + 4);
      if (sha && subject !== undefined && author !== undefined && date !== undefined) commits.push({ sha, subject, author, date });
    }
    return { commits };
  }
  async diff(projectPath: string, comparison: Comparison): Promise<DiffSnapshot> {
    const root = await this.root(projectPath);
    let baseCommit: string;
    let commitDiffArgs: string[] | null = null;
    if (comparison.kind === "uncommitted") {
      try { baseCommit = await this.resolveCommit(root, "HEAD"); }
      catch {
        // An unborn branch has no HEAD: compare against Git's empty tree.
        baseCommit = (await runGit(root, ["hash-object", "-t", "tree", "--stdin"])).trim();
      }
    } else {
      const ref = await this.resolveCommit(root, comparison.kind === "branch" ? comparison.ref : comparison.sha);
      if (comparison.kind === "branch") {
        try { baseCommit = (await runGit(root, ["merge-base", "HEAD", ref])).trim(); }
        catch { throw new GitError("invalidBase", "This branch has no common ancestor with HEAD."); }
      } else {
        const parents = (await runGit(root, ["rev-list", "--parents", "-n", "1", ref])).trim().split(" ");
        baseCommit = parents[1] ?? ref;
        commitDiffArgs = parents[1] ? [baseCommit, ref] : ["--root", "--no-commit-id", "-r", ref];
      }
    }
    const diffCommand = commitDiffArgs && comparison.kind === "commit" && commitDiffArgs[0] === "--root" ? "diff-tree" : "diff";
    const diffArgs = commitDiffArgs ?? [baseCommit];
    const [names, untracked, branch] = await Promise.all([
      runGit(root, [diffCommand, "--no-ext-diff", "--no-textconv", "--no-renames", "--name-status", "-z", ...diffArgs, "--"]),
      commitDiffArgs ? Promise.resolve("") : runGit(root, ["ls-files", "--others", "--exclude-standard", "-z"]), this.branch(root),
    ]);
    const entries = new Map<string, ChangedFile["status"]>();
    const fields = names.split("\0");
    for (let index = 0; index + 1 < fields.length; index += 2) {
      const status = fields[index];
      const path = fields[index + 1];
      if (path && (status === "A" || status === "M" || status === "D" || status === "T")) entries.set(path, status);
    }
    const untrackedPaths = new Set(untracked.split("\0").filter(Boolean));
    for (const path of untrackedPaths) if (!entries.has(path)) entries.set(path, "A");
    if (entries.size > MAX_FILES) throw new GitError("tooLarge", "More than 200 files changed. Choose a more recent base.");
    const files: ChangedFile[] = [];
    let bytes = 0;
    for (const [path, status] of [...entries].sort(([a], [b]) => a.localeCompare(b))) {
      const patch = untrackedPaths.has(path)
        ? await this.untrackedPatch(root, path)
        : await runGit(root, [diffCommand, "--no-ext-diff", "--no-textconv", "--no-renames", ...(diffCommand === "diff-tree" ? ["-p"] : []), "--unified=3", ...diffArgs, "--", path]);
      bytes += Buffer.byteLength(patch);
      if (bytes > MAX_BYTES) throw new GitError("tooLarge", "The comparison exceeds 2 MiB. Choose a more recent base.");
      const lines = parsePatch(patch);
      files.push({ path, status, patch, binary: /^(?:Binary files |GIT binary patch)/m.test(patch),
        added: lines.filter(line => line.kind === "add").length, removed: lines.filter(line => line.kind === "remove").length });
    }
    return { branch, baseCommit, files };
  }
  private async untrackedPatch(root: string, path: string): Promise<string> {
    const absolute = resolve(root, path);
    const inside = relative(root, absolute);
    if (inside === ".." || inside.startsWith(".." + sep) || isAbsolute(inside)) throw new GitError("operationFailed", "A changed path is outside this repository.");
    const info = await lstat(absolute);
    let bytes: Buffer;
    if (info.isSymbolicLink()) bytes = Buffer.from(await readlink(absolute));
    else {
      const canonicalParent = await realpath(resolve(absolute, ".."));
      const parent = relative(root, canonicalParent);
      if (parent === ".." || parent.startsWith(".." + sep) || isAbsolute(parent)) throw new GitError("operationFailed", "A changed path is outside this repository.");
      if (!info.isFile() || info.size > MAX_BYTES) throw new GitError("tooLarge", "An untracked file is too large or not a regular file.");
      const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const buffer = Buffer.alloc(MAX_BYTES + 1);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        if (bytesRead > MAX_BYTES) throw new GitError("tooLarge", "An untracked file exceeds 2 MiB.");
        bytes = buffer.subarray(0, bytesRead);
      } finally { await handle.close(); }
    }
    if (bytes.includes(0)) return "Binary files differ\n";
    const text = bytes.toString("utf8");
    if (!text) return "";
    const lines = text.split("\n");
    if (text.endsWith("\n")) lines.pop();
    return "@@ -0,0 +1," + lines.length + " @@\n" + lines.map(line => "+" + line + "\n").join("") + (text.endsWith("\n") ? "" : "\\ No newline at end of file\n");
  }
}
