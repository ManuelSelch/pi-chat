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
it("lists commit names newest first and filters history", async()=>{
  git.commit("First"); git.commit("Second"); git.commit("Third");

  await git.shouldListCommits("",["Third","Second","First"]);
  await git.shouldListCommits("second",["Second"]);
});
it("paginates older commits without duplicates", async()=>{
  for (let index=0;index<51;index++) git.commit("Commit "+index);

  await git.shouldPaginateCommits();
});
it("supports unborn repositories and empty added files", async()=>{
  await git.write("empty","");
  await git.write("new","hello\n");

  await git.compare();

  git.shouldShowFiles(["empty","new"]);
  git.shouldHaveCounts("empty",0,0);
  await git.shouldListCommits("",[]);
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
