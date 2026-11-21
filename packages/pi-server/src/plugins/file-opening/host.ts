import type { HostPluginContext } from "@manuelselch/pi-sdk/plugins";
import { fileOpeningContract } from "@manuelselch/pi-sdk/plugins/file-opening";
import type { FileOpeningServices } from "./index.js";

export function setup(ctx: HostPluginContext, services: FileOpeningServices): void {
  ctx.provide(fileOpeningContract, {
    open: ({ sessionId, path }) => services.open(sessionId, path),
  });
}
