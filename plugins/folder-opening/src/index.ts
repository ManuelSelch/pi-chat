import { directoryBrowseSchema } from "@manuelselch/pi-sdk/protocol";
import { definePlugin, defineRemoteContract, type RemoteContractClient } from "@manuelselch/pi-sdk/plugins";
import { folderBrowseResultSchema } from "./schemas.js";

export { folderBrowseResultSchema } from "./schemas.js";

/** Read-only server folder browsing; session creation remains an application action. */
export const folderOpeningContract = defineRemoteContract({
  id: "folder-opening",
  version: 1,
  methods: {
    browse: {
      input: directoryBrowseSchema,
      output: folderBrowseResultSchema,
    },
  },
});

/** One identity; each runtime loads only its own contributions. */
export const folderOpeningPlugin = definePlugin({
  id: "folder-opening",
  provides: [folderOpeningContract],
  // Vite must not traverse Node-only implementation imports into the browser build.
  host: async () => (await import(/* @vite-ignore */ "./host/index.js")).createFolderOpeningHost(),
  web: async () => (await import("./web/index.js")).folderOpeningUI,
});

export type FolderBrowseResult = ReturnType<typeof folderBrowseResultSchema.parse>;
export type FolderOpeningContract = RemoteContractClient<typeof folderOpeningContract>;
