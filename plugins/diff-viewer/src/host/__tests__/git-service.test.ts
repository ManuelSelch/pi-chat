import { afterEach, beforeEach, it } from "vitest";
import { GitDriver } from "./git-driver.js";

let git: GitDriver;
beforeEach(async()=>{ git = new GitDriver(); await git.start(); });
afterEach(async()=>{ await git.dispose(); });

it("combines staged, unstaged and untracked changes without ignored files", async()=>{
  await git.write("tracked.ts","before\n"); git.commit("Initial");
  await git.write("tracked.ts","staged\n"); git.stage();
  await git.write("tracked.ts","working\n");
  await git.write("new file.ts","new\n");
  await git.write(".gitignore","ignored\n"); await git.write("ignored","secret");

  await git.compare();

  git.shouldShowFiles(["tracked.ts","new file.ts",".gitignore"]);
  git.shouldShowPatch("tracked.ts","-before\n+working");
  git.shouldHaveCounts("tracked.ts",1,1);
});
it("compares from a branch merge-base rather than its advanced tip", async()=>{
  await git.write("base","initial\n"); git.commit("Initial"); git.branch("feature");
  await git.write("feature","work\n"); git.commit("Feature");
  git.checkout("main"); await git.write("other","upstream\n"); git.commit("Upstream"); git.checkout("feature");

  await git.compare({kind:"branch",ref:"refs/heads/main"});

  git.shouldShowFiles(["feature"]);
  await git.shouldListBranches(["feature","main"]);
});
it("shows only the selected commit, excluding later and uncommitted changes", async()=>{
  await git.write("file","first\n"); git.commit("First");
  await git.write("file","second\n"); const sha = git.commit("Second");
  await git.write("file","third\n"); git.commit("Third"); await git.write("file","working\n");
  await git.write("untracked","not committed\n");

  await git.compare({kind:"commit",sha});

  git.shouldShowFiles(["file"]);
  git.shouldShowPatch("file","-first\n+second");
});
it("shows the initial commit against an empty tree", async()=>{
  await git.write("file","first\n"); const sha = git.commit("First");

  await git.compare({kind:"commit",sha});

  git.shouldShowFiles(["file"]);
  git.shouldShowPatch("file","+first");
});
it("lists only the five most recent commits, newest first", async()=>{
  for (let index=0;index<7;index++) git.commit("Commit "+index);

  await git.shouldListCommits(["Commit 6","Commit 5","Commit 4","Commit 3","Commit 2"]);
});
it("suggests the default and nearest two local ancestor branches, not unrelated branches", async()=>{
  git.commit("Initial"); git.branch("old-parent"); git.commit("Old parent");
  git.branch("parent"); git.commit("Parent"); git.branch("nearest"); git.commit("Nearest");
  git.branch("feature"); git.commit("Feature");
  git.checkout("main"); git.branch("unrelated"); git.commit("Unrelated"); git.checkout("feature");

  await git.shouldSuggestBases("refs/heads/main",["refs/heads/nearest","refs/heads/parent"]);
});
it("deduplicates matching local/remote tips but retains diverged remote branches", async()=>{
  git.commit("Initial"); git.trackRemote("origin/main");
  git.branch("parent"); git.commit("Parent"); git.trackRemote("origin/parent");
  git.branch("feature"); git.commit("Feature"); git.trackRemote("origin/feature");
  git.trackRemote("upstream/parent","main");

  await git.shouldIncludeRefs(["refs/heads/main","refs/heads/parent","refs/heads/feature","refs/remotes/upstream/parent"],["refs/remotes/origin/main","refs/remotes/origin/parent","refs/remotes/origin/feature"]);
});
it("uses the remote default and supports master repositories",async()=>{
  git.commit("Initial"); git.branch("master"); git.trackRemote("origin/master");
  git.setRemoteDefault("refs/remotes/origin/master"); git.branch("feature"); git.commit("Feature");

  await git.shouldSuggestBases("refs/heads/master",[]);
});
it("uses master without remote metadata",async()=>{
  git.commit("Initial"); git.renameBranch("master");
  git.branch("feature"); git.commit("Feature");

  await git.shouldSuggestBases("refs/heads/master",[]);
});
it("returns ancestor suggestions without inventing a repository default",async()=>{
  git.commit("Initial"); git.renameBranch("trunk");
  git.branch("feature"); git.commit("Feature");

  await git.shouldSuggestBases(null,["refs/heads/trunk"]);
});
it("returns no suggestions for unborn repositories",async()=>{
  await git.shouldSuggestBases(null,[]);
});
it("supports unborn repositories and empty added files", async()=>{
  await git.write("empty","");
  await git.write("new","hello\n");

  await git.compare();

  git.shouldShowFiles(["empty","new"]);
  git.shouldHaveCounts("empty",0,0);
  await git.shouldListCommits([]);
});
it("preserves unusual filenames and missing newline markers", async()=>{
  git.commit("Initial"); await git.write("space ü\tline\nfile","hello");

  await git.compare();

  git.shouldShowFiles(["space ü\tline\nfile"]);
  git.shouldShowPatch("space ü\tline\nfile","\\ No newline at end of file");
});
it("shows binary changes without rendering their payload", async()=>{
  git.commit("Initial"); await git.write("image",Buffer.from([1,0,2]));

  await git.compare();

  git.shouldMarkBinary("image");
  git.shouldHaveCounts("image",0,0);
});
it("reads symlink text without opening its target", async()=>{
  git.commit("Initial"); await git.link("outside","/definitely-not-a-readable-target");

  await git.compare();

  git.shouldShowPatch("outside","+/definitely-not-a-readable-target");
});
it("fails clearly for missing bases and non-repository projects", async()=>{
  git.commit("Initial");

  await git.shouldRejectBase("0".repeat(40));
  await git.shouldRejectNonRepository();
});
it("rejects oversized untracked files rather than returning partial diffs", async()=>{
  git.commit("Initial"); await git.write("huge",Buffer.alloc(2*1024*1024+1,65));

  await git.shouldRejectOversizedFile();
});
