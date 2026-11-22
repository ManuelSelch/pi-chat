import type { ReactNode } from "react";
import { definePlugin, type Plugin, type PluginUI } from "@manuelselch/pi-sdk/plugins";

/** Loaded contributions retain their declaration's identity, not a second UI identity. */
export interface LoadedPluginUI {
  readonly id: string;
  readonly ui: PluginUI<ReactNode>;
}

/** Load and validate a static composition before rendering; never activates host logic. */
export async function loadPluginUIs(plugins: readonly Plugin<ReactNode>[]): Promise<readonly LoadedPluginUI[]> {
  const ids = new Set<string>();
  for (const plugin of plugins) {
    definePlugin(plugin);
    if (ids.has(plugin.id)) throw new Error(`Duplicate plugin: ${plugin.id}`);
    ids.add(plugin.id);
  }

  const loaded = await Promise.all(plugins.filter(plugin => plugin.web).map(async plugin => ({
    id: plugin.id,
    ui: await plugin.web!(),
  })));
  validatePluginUIs(loaded);
  return loaded;
}

function validatePluginUIs(plugins: readonly LoadedPluginUI[]): void {
  const commandIds = new Set<string>();
  const contributionIds = new Set<string>();
  for (const plugin of plugins) {
    for (const contribution of plugin.ui.contributions ?? []) {
      if (!contribution.id.startsWith(`${plugin.id}.`)) throw new Error(`Contribution ${contribution.id} must use the ${plugin.id} namespace.`);
      if (contributionIds.has(contribution.id)) throw new Error(`Duplicate contribution: ${contribution.id}`);
      contributionIds.add(contribution.id);
      if (contribution.placement !== "settings.feature-toggles") throw new Error(`Unknown UI placement: ${contribution.placement}`);
    }
    for (const command of plugin.ui.commands ?? []) {
      if (!command.id.startsWith(`${plugin.id}.`)) throw new Error(`Command ${command.id} must use the ${plugin.id} namespace.`);
      if (commandIds.has(command.id)) throw new Error(`Duplicate command: ${command.id}`);
      commandIds.add(command.id);
      for (const placement of command.placements)
        if (placement !== "menus" && placement !== "projects") throw new Error(`Unknown command placement: ${placement}`);
    }
  }
}
