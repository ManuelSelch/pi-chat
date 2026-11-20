import { definePlugin } from "@manuelselch/pi-sdk/plugins";
import { fileOpeningContract } from "@manuelselch/pi-sdk/plugins/file-opening";

/** Inactive host scaffold; not included in the server's default plugin list. */
export default definePlugin({
  id: "file-opening",
  provides: [fileOpeningContract],
  host: () => import("./host.js"),
});
