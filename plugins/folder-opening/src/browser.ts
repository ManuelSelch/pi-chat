import { definePlugin } from "@manuelselch/pi-sdk/plugins";
import { folderOpeningContract } from "./contract.js";
import { folderOpeningUI } from "./web/index.js";

export * from "./contract.js";

/** Browser builds resolve only UI contributions, never Node implementations. */
export const folderOpeningPlugin = definePlugin({
  id: "folder-opening",
  provides: [folderOpeningContract],
  web: () => folderOpeningUI,
});
