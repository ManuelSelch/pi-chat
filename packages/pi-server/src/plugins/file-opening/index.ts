import { type HostPluginContext, definePlugin } from "@manuelselch/pi-sdk/plugins";
import { fileOpeningContract } from "@manuelselch/pi-sdk/plugins/file-opening";
import type { FileOpenResult } from "@manuelselch/pi-sdk/protocol";

export interface FileOpeningServices {
  open(sessionId: string, path: string): Promise<FileOpenResult>;
}

/** Explicit opt-in; the server owns session lookup and OS opening. */
export function createFileOpeningPlugin(services: FileOpeningServices) {
  return definePlugin({
    id: "file-opening",
    provides: [fileOpeningContract],
    host: async () => {
      const { setup } = await import("./host.js");
      return { setup: (ctx: HostPluginContext) => setup(ctx, services) };
    },
  });
}
