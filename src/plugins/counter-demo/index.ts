import { definePlugin } from "@manuelselch/pi-sdk/plugins";
import { counterContract } from "./contract.js";

export default definePlugin({
  id: "test-counter",
  provides: [counterContract],
  host: () => import("./host.js"),
});
