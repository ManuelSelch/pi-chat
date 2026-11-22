import { directoryBrowseSchema } from "@manuelselch/pi-sdk/protocol";
import { defineRemoteContract, type RemoteContractClient } from "@manuelselch/pi-sdk/plugins";
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

export type FolderBrowseResult = ReturnType<typeof folderBrowseResultSchema.parse>;
export type FolderOpeningContract = RemoteContractClient<typeof folderOpeningContract>;
