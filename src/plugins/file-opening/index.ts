/** Inactive built-in scaffold; no package manifest or runtime registration. */
const fileOpening = {
  id: "file-opening",
  host: () => import("./host.js"),
  web: () => import("./web.js"),
} as const;

export type { FileOpeningContract, OpenFileInput } from "./contract.js";
export default fileOpening;
