import type { HostPluginEntry } from "@manuelselch/pi-sdk/plugins";
import { folderOpeningContract, type FolderBrowseResult } from "../index.js";
import { DirectoryBrowserService, DirectoryOperationError } from "./directory-browser-service.js";

export { DirectoryBrowserService, DirectoryOperationError } from "./directory-browser-service.js";

/** Owns browsing independently of Pi sessions and server application state. */
export function createFolderOpeningHost(directories: Pick<DirectoryBrowserService, "browse"> = new DirectoryBrowserService()): HostPluginEntry {
  return { setup(ctx) {
    ctx.provide(folderOpeningContract, { browse: async (request): Promise<FolderBrowseResult> => {
      try {
        const { parentPath, nextCursor, ...listing } = await directories.browse(request);
        return { ok: true, listing: { ...listing,
          ...(parentPath === undefined ? {} : { parentPath }),
          ...(nextCursor === undefined ? {} : { nextCursor }),
        } } satisfies FolderBrowseResult;
      } catch (error) {
        if (error instanceof DirectoryOperationError) return { ok: false, error: { code: error.code, message: error.message } };
        return { ok: false, error: { code: "operationFailed", message: "Unable to read this server folder." } };
      }
    } });
  } };
}
