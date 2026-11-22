import { type HostPluginContext, definePlugin } from "@manuelselch/pi-sdk/plugins";
import { fileOpeningContract } from "../contract.js";
import type { FileOpenResult } from "@manuelselch/pi-sdk/protocol";

export interface FileOpeningServices {
  open(sessionId: string, path: string): Promise<FileOpenResult>;
}

export { FileService } from "./file-service.js";
export { FileOpenError, fileOpenFailure } from "./file-open-error.js";
export { SystemFileOpener, type FileOpener } from "./system-file-opener.js";
export * from "../contract.js";

/** Explicit opt-in; the server supplies session lookup, the plugin owns OS opening. */
export function createFileOpeningPlugin(services: FileOpeningServices) {
  return definePlugin({
    id: "file-opening",
    provides: [fileOpeningContract],
    host: async () => {
      const { setup } = await import("./setup.js");
      return { setup: (ctx: HostPluginContext) => setup(ctx, services) };
    },
  });
}
