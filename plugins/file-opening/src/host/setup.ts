import type { HostPluginContext } from "@manuelselch/pi-sdk/plugins";
import { fileOpeningContract } from "../contract.js";
import type { FileOpeningServices } from "./index.js";
import { FileService } from "./file-service.js";
import { fileOpenFailure } from "./file-open-error.js";

export function setup(ctx: HostPluginContext, services: FileOpeningServices, files: Pick<FileService, "open"> = new FileService()): void {
  ctx.provide(fileOpeningContract, {
    open: async ({ sessionId, path }) => {
      let session: { projectPath: string };
      try { session = await services.getSession(sessionId); }
      catch { return fileOpenFailure("sessionUnavailable", "This session is no longer available on the server."); }
      return files.open(session.projectPath, path);
    },
  });
}
