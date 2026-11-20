import type { HostPluginContext } from "@manuelselch/pi-sdk/plugins";
import { counterContract } from "./contract.js";

export function setup(ctx: HostPluginContext): void {
  let count = 0;
  ctx.provide(counterContract, {
    read: () => count,
    increment: () => ++count,
  });
}
