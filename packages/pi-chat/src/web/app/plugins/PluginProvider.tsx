import { createContext, memo, useContext, useMemo, type ReactNode } from "react";
import type { CommandPlacement, PluginCommand, PluginCommandDefinition, PluginUIHost } from "@manuelselch/pi-sdk/plugins";

import type { LoadedPluginUI } from "./load-plugin-ui.js";

interface PluginContextValue {
  plugins: readonly LoadedPluginUI[];
  commands: readonly PluginCommand[];
  blocking: boolean;
}
const PluginContext = createContext<PluginContextValue>({ plugins: [], commands: [], blocking: false });

/** Compose React providers before reading their command/overlay context.
 * Memoization only skips unrelated shell renders; it is not needed for correctness.
 */
export const PluginProvider = memo(function PluginProvider({ plugins, host, children }: { plugins: readonly LoadedPluginUI[]; host: PluginUIHost; children: ReactNode }) {
  const ids = new Set<string>();
  const commandIds = new Set<string>();
  for (const plugin of plugins) {
    if (ids.has(plugin.id)) throw new Error(`Duplicate plugin: ${plugin.id}`);
    ids.add(plugin.id);
    for (const command of plugin.ui.commands) {
      if (!command.id.startsWith(`${plugin.id}.`)) throw new Error(`Command ${command.id} must use the ${plugin.id} namespace.`);
      if (commandIds.has(command.id)) throw new Error(`Duplicate command: ${command.id}`);
      commandIds.add(command.id);
    }
  }
  const bound = plugins.reduceRight<ReactNode>((content, plugin) =>
    <PluginBindings key={plugin.id} plugin={plugin}>{content}</PluginBindings>, children);
  const provided = plugins.reduceRight<ReactNode>((content, plugin) =>
    <plugin.ui.Provider key={plugin.id} host={host}>{content}</plugin.ui.Provider>, bound);
  return <PluginContext.Provider value={{ plugins, commands: [], blocking: false }}>{provided}</PluginContext.Provider>;
});

function PluginBindings({ plugin, children }: { plugin: LoadedPluginUI; children: ReactNode }) {
  const parent = useContext(PluginContext);
  const opened = plugin.ui.useOverlayOpen();
  return <PluginContext.Provider value={{ ...parent, blocking: parent.blocking || opened }}>
    {plugin.ui.commands.reduceRight<ReactNode>((content, command) =>
      <CommandBinding key={command.id} command={command}>{content}</CommandBinding>, children)}
  </PluginContext.Provider>;
}

function CommandBinding({ command, children }: { command: PluginCommandDefinition; children: ReactNode }) {
  const parent = useContext(PluginContext);
  const { useAction, ...metadata } = command;
  const action = useAction();
  const bound = { ...metadata, ...action, run: () => { if (!action.disabled) action.run(); } };
  return <PluginContext.Provider value={{ ...parent, commands: [...parent.commands, bound] }}>{children}</PluginContext.Provider>;
}

export function usePluginCommands(placement: CommandPlacement): readonly PluginCommand[] {
  const { commands } = useContext(PluginContext);
  return useMemo(() => commands.filter(command => command.placements.includes(placement)), [commands, placement]);
}

export function usePluginOverlayOpen(): boolean {
  return useContext(PluginContext).blocking;
}

export function PluginOverlayOutlet() {
  return <>{useContext(PluginContext).plugins.map(plugin => <plugin.ui.Overlay key={plugin.id} />)}</>;
}
