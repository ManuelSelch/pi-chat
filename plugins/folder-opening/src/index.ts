import { definePlugin } from "@manuelselch/pi-sdk/plugins";
import { folderOpeningContract } from "./contract.js";
import { createFolderOpeningHost } from "./host/index.js";

export * from "./contract.js";

/** Node resolves only the host contribution; browser peers are not required. */
export const folderOpeningPlugin = definePlugin({
  id: "folder-opening",
  provides: [folderOpeningContract],
  host: () => createFolderOpeningHost(),
});
