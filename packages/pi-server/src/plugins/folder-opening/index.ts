import { definePlugin, type HostPluginContext } from "@manuelselch/pi-sdk/plugins";
import { folderOpeningContract, type FolderBrowseResult } from "@manuelselch/pi-sdk/plugins/folder-opening";
import type { DirectoryBrowse } from "@manuelselch/pi-sdk/protocol";

export interface FolderOpeningServices {
  browse(request: DirectoryBrowse): Promise<FolderBrowseResult>;
}

export function createFolderOpeningPlugin(services: FolderOpeningServices) {
  return definePlugin({
    id: "folder-opening",
    provides: [folderOpeningContract],
    host: async () => ({ setup(ctx: HostPluginContext) {
      ctx.provide(folderOpeningContract, { browse: request => services.browse(request) });
    } }),
  });
}
