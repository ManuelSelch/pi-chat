import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SessionManager, type ExtensionFactory } from "@earendil-works/pi-coding-agent";

/** Isolated equivalent of /worktree create's Git + ctx.switchSession boundary.
 * No external extension installation or user session directories are touched. */
export const worktreeCommandFixture: ExtensionFactory = pi => {
  pi.registerCommand("worktree", {
    description: "Create an isolated test worktree and switch into it",
    handler: async (args, ctx) => {
      if (args !== "create feature/new-checkout") throw new Error("Unexpected fixture command");
      execFileSync("git", ["-C", ctx.cwd, "worktree", "add", "-b", "feature/new-checkout", join(ctx.cwd, "new-checkout")], { stdio: "ignore" });
      // The harness extension context retains its original in-memory manager.
      // Its session directory is undefined, which would select the user's ~/.pi.
      const replacement = SessionManager.create(join(ctx.cwd, "new-checkout"), join(ctx.cwd, ".pi-sessions"));
      replacement.appendCustomEntry("pify-worktree-session", { path: replacement.getCwd() });
      const file = replacement.getSessionFile()!;
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, [replacement.getHeader(), ...replacement.getEntries()].map(entry => JSON.stringify(entry)).join("\n") + "\n");
      await ctx.switchSession(file);
    },
  });
};
