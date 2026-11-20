import { definePlugin } from "@manuelselch/pi-sdk/plugins";
import { fileOpeningContract } from "@manuelselch/pi-sdk/plugins/file-opening";

/** Inactive built-in scaffold; no package manifest or runtime registration. */
const fileOpening = definePlugin({
  id: "file-opening",
  requires: [fileOpeningContract],
  web: () => import("./web.js"),
});

export type { FileOpeningContract, OpenFileInput } from "@manuelselch/pi-sdk/plugins/file-opening";
export default fileOpening;
