import { definePlugin, type HostPluginEntry } from "@manuelselch/pi-sdk/plugins";
import { diffViewerContract } from "../contract.js";
import { GitService } from "./git-service.js";
import { GitError } from "./git-command.js";

export function createDiffViewerHost(service = new GitService()): HostPluginEntry {
  async function safely<T>(operation: () => Promise<T>) {
    try { return { ok: true as const, value: await operation() }; }
    catch (error) {
      return { ok: false as const, error: error instanceof GitError
        ? { code: error.code, message: error.message }
        : { code: "operationFailed" as const, message: "Unable to read this comparison. Refresh and try again." } };
    }
  }
  return { setup(ctx) {
    ctx.provide(diffViewerContract, {
      context: input => safely(() => service.context(input.projectPath)),
      commits: input => safely(() => service.commits(input.projectPath)),
      diff: input => safely(() => service.diff(input.projectPath, input.comparison)),
    });
  } };
}
export * from "../contract.js";
export const diffViewerPlugin = definePlugin({
  id: "diff-viewer", provides: [diffViewerContract], host: () => createDiffViewerHost(),
});
