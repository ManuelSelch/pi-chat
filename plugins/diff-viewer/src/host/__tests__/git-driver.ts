import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, rm, symlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect } from "vitest";
import { GitService } from "../git-service.js";
import type { Comparison, DiffSnapshot } from "../../contract.js";

export class GitDriver {
  private root = "";
  private service = new GitService();
  private snapshot?: DiffSnapshot;
  private git(...args: string[]) {
    return execFileSync("git", ["-C", this.root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", ...args], { encoding: "utf8", stdio: ["ignore","pipe","pipe"] }).trim();
  }
  async start() { this.root = await mkdtemp(join(tmpdir(),"pi-diff-")); this.git("init","--initial-branch=main"); }
  async dispose() { await rm(this.root,{recursive:true,force:true}); }
  async write(path: string, content: string | Buffer) { await mkdir(dirname(join(this.root,path)),{recursive:true}); await writeFile(join(this.root,path),content); }
  async link(path: string, target: string) { await symlink(target,join(this.root,path)); }
  stage() { this.git("add","-A"); }
  commit(message: string) { this.stage(); this.git("commit","--allow-empty","-m",message); return this.git("rev-parse","HEAD"); }
  branch(name: string) { this.git("checkout","-b",name); }
  checkout(name: string) { this.git("checkout",name); }
  renameBranch(name:string) { this.git("branch","-m",name); }
  async compare(comparison: Comparison = {kind:"uncommitted"}) { this.snapshot = await this.service.diff(this.root,comparison); }
  shouldShowFiles(paths: string[]) { expect(this.snapshot?.files.map(file=>file.path).sort()).toEqual([...paths].sort()); }
  shouldShowPatch(path: string, text: string) { expect(this.snapshot?.files.find(file=>file.path===path)?.patch).toContain(text); }
  shouldMarkBinary(path: string) { expect(this.snapshot?.files.find(file=>file.path===path)?.binary).toBe(true); }
  shouldHaveCounts(path: string, added: number, removed: number) { expect(this.snapshot?.files.find(file=>file.path===path)).toMatchObject({added,removed}); }
  async shouldListCommits(subjects: string[]) { expect((await this.service.commits(this.root)).commits.map(commit=>commit.subject)).toEqual(subjects); }
  trackRemote(name:string,ref="HEAD") { this.git("update-ref","refs/remotes/"+name,ref); }
  setRemoteDefault(ref:string) { this.git("symbolic-ref","refs/remotes/origin/HEAD",ref); }
  async shouldSuggestBases(defaultBranch:string|null,suggestedBranches:string[]) {
    expect(await this.service.context(this.root)).toMatchObject({defaultBranch,suggestedBranches});
  }
  async shouldIncludeRefs(refs:string[],excluded:string[]) {
    const branches = (await this.service.context(this.root)).branches.map(branch=>branch.ref);
    for (const ref of refs) expect(branches).toContain(ref);
    for (const ref of excluded) expect(branches).not.toContain(ref);
  }
  async shouldListBranches(names: string[]) { expect((await this.service.context(this.root)).branches.map(branch=>branch.name)).toEqual(names); }
  async shouldRejectBase(sha: string) { await expect(this.service.diff(this.root,{kind:"commit",sha})).rejects.toThrow("no longer available"); }
  async shouldRejectNonRepository() { await expect(this.service.context(tmpdir())).rejects.toThrow("Git working tree"); }
  async shouldRejectOversizedFile() { await expect(this.service.diff(this.root,{kind:"uncommitted"})).rejects.toThrow("too large"); }
}
