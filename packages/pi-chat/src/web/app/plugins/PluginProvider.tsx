import { createContext, memo, useContext, useMemo, type ReactNode } from "react";
import { Stack } from "@mantine/core";
import type { CommandPlacement, PluginCommand, PluginCommandDefinition, PluginUIHost, PluginUIPlacement } from "@manuelselch/pi-sdk/plugins";

import type { LoadedPluginUI } from "./load-plugin-ui.js";

interface PluginContextValue {
  plugins: readonly LoadedPluginUI[];
  commands: readonly PluginCommand[];
  blocking: boolean;
}
const PluginContext = createContext<PluginContextValue>({ plugins: [], commands: [], blocking: false });

/** Compose UIs validated by loadPluginUIs before reading their command/overlay context.
 * Memoization only skips unrelated shell renders; it is not needed for correctness.
 */
export const PluginProvider = memo(function PluginProvider({ plugins, host, children }: { plugins: readonly LoadedPluginUI[]; host: PluginUIHost; children: ReactNode }) {
  const bound = plugins.reduceRight<ReactNode>((content, plugin) =>
    <PluginBindings key={plugin.id} plugin={plugin}>{content}</PluginBindings>, children);
  const provided = plugins.reduceRight<ReactNode>((content, plugin) =>
    <plugin.ui.Provider key={plugin.id} host={host}>{content}</plugin.ui.Provider>, bound);
  return <PluginContext.Provider value={{ plugins, commands: [], blocking: false }}>{provided}</PluginContext.Provider>;
});

function PluginBindings({ plugin, children }: { plugin: LoadedPluginUI; children: ReactNode }) {
  const bound = (plugin.ui.commands ?? []).reduceRight<ReactNode>((content, command) =>
    <CommandBinding key={command.id} command={command}>{content}</CommandBinding>, children);
  return plugin.ui.useOverlayOpen
    ? <OverlayBinding useOverlayOpen={plugin.ui.useOverlayOpen}>{bound}</OverlayBinding>
    : bound;
}

function OverlayBinding({ useOverlayOpen, children }: { useOverlayOpen: () => boolean; children: ReactNode }) {
  const parent = useContext(PluginContext);
  const opened = useOverlayOpen();
  return <PluginContext.Provider value={{ ...parent, blocking: parent.blocking || opened }}>{children}</PluginContext.Provider>;
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
  return <>{useContext(PluginContext).plugins.map(plugin => plugin.ui.Overlay ? <plugin.ui.Overlay key={plugin.id} /> : null)}</>;
}

/** The shell owns feature-toggle spacing; contributed controls own their state. */
export function PluginUIOutlet({ placement }: { placement: PluginUIPlacement }) {
  const { plugins } = useContext(PluginContext);
  const contributions = plugins.flatMap(plugin => plugin.ui.contributions ?? []).filter(item => item.placement === placement);
  if (!contributions.length) return null;
  return <Stack gap="sm" mt="sm">{contributions.map(item => <item.Component key={item.id} />)}</Stack>;
}
