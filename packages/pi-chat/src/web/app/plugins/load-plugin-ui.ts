import type { ReactNode } from "react";
import { definePlugin, type Plugin, type PluginUI } from "@manuelselch/pi-sdk/plugins";

/** Loaded contributions retain their declaration's identity, not a second UI identity. */
export interface LoadedPluginUI {
  readonly id: string;
  readonly ui: PluginUI<ReactNode>;
}

/** Static startup composition; no host activation or effect-based registration. */
export async function loadPluginUIs(plugins: readonly Plugin<ReactNode>[]): Promise<readonly LoadedPluginUI[]> {
  const ids = new Set<string>();
  for (const plugin of plugins) {
    definePlugin(plugin);
    if (ids.has(plugin.id)) throw new Error(`Duplicate plugin: ${plugin.id}`);
    ids.add(plugin.id);
  }

  return Promise.all(plugins.filter(plugin => plugin.web).map(async plugin => ({
    id: plugin.id,
    ui: await plugin.web!(),
  })));
}
