import { definePlugin } from "../sdk/index.js";
import { fileOpeningContract } from "./contract.js";

/** Inactive built-in scaffold; no package manifest or runtime registration. */
const fileOpening = definePlugin({
  id: "file-opening",
  provides: [fileOpeningContract],
  host: () => import("./host.js"),
  web: () => import("./web.js"),
});

export type { FileOpeningContract, OpenFileInput } from "./contract.js";
export default fileOpening;
