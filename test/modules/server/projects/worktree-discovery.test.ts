import { describe, expect, it } from "vitest";
import { parseWorktreeList, WorktreeDiscovery } from "../../../../src/server/projects/worktree-discovery.js";

describe("parseWorktreeList", () => {
  it("parses primary, linked, and detached worktrees", () => {
    const result = parseWorktreeList([
      "worktree /work/pi-chat",
      "HEAD abc123456789",
      "branch refs/heads/main",
      "",
      "worktree /home/me/.worktrees/pi-chat/feature",
      "HEAD def987654321",
      "branch refs/heads/feat/worktree",
      "",
      "worktree /tmp/detached",
      "HEAD 112233445566",
      "detached",
      "",
    ].join("\n"));

    expect(result).toEqual([
      { path: "/work/pi-chat", commit: "abc123456789", branch: "main", detached: false },
      { path: "/home/me/.worktrees/pi-chat/feature", commit: "def987654321", branch: "feat/worktree", detached: false },
      { path: "/tmp/detached", commit: "112233445566", detached: true },
    ]);
  });
});

describe("WorktreeDiscovery", () => {
  it("groups discovery by the canonical git common directory", async () => {
    const calls: string[][] = [];
    const discovery = new WorktreeDiscovery(async (command, args) => {
      calls.push([command, ...args]);
      if (args.includes("rev-parse")) return "../pi-chat/.git\n";
      return "worktree /work/pi-chat\nHEAD abc\nbranch refs/heads/main\n\nworktree /work/feature\nHEAD def\nbranch refs/heads/feature\n";
    });

    await expect(discovery.forDirectory("/work/feature")).resolves.toEqual({
      repositoryPath: "/work/pi-chat",
      worktrees: [
        { path: "/work/pi-chat", commit: "abc", branch: "main", detached: false, primary: true },
        { path: "/work/feature", commit: "def", branch: "feature", detached: false, primary: false },
      ],
    });
    expect(calls).toEqual([
      ["git", "-C", "/work/feature", "rev-parse", "--git-common-dir"],
      ["git", "-C", "/work/pi-chat", "worktree", "list", "--porcelain"],
    ]);
  });

  it("returns undefined when a directory is not a git checkout", async () => {
    const discovery = new WorktreeDiscovery(async () => { throw new Error("not git"); });
    await expect(discovery.forDirectory("/tmp/plain")).resolves.toBeUndefined();
  });
});
