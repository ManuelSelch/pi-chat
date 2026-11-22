import { createContext, Fragment, memo, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CommandPlacement, PluginCommand, WebPlugin, WebPluginContributions, WebPluginHost } from "@manuelselch/pi-sdk/plugins";

type Contributions = WebPluginContributions<ReactNode>;
interface PluginContextValue {
  commands: readonly PluginCommand[];
  overlays: { items: readonly ReactNode[]; blocking: boolean };
}
const PluginContext = createContext<PluginContextValue>({ commands: [], overlays: { items: [], blocking: false } });

/** One mounted hook scope per explicit registration; no loader or global registry. */
export function PluginProvider({ plugins, host, children }: { plugins: readonly WebPlugin<ReactNode>[]; host: WebPluginHost; children: ReactNode }) {
  const [contributions, setContributions] = useState<ReadonlyMap<string, Contributions>>(new Map());
  const ids = new Set<string>();
  for (const plugin of plugins) {
    if (ids.has(plugin.id)) throw new Error(`Duplicate plugin: ${plugin.id}`);
    ids.add(plugin.id);
  }
  const register = useCallback((id: string, value?: Contributions) => {
    setContributions(current => {
      const next = new Map(current);
      if (value) next.set(id, value);
      else next.delete(id);
      return next;
    });
  }, []);
  const active = plugins.flatMap(plugin => {
    const value = contributions.get(plugin.id);
    return value ? [{ id: plugin.id, ...value }] : [];
  });
  const commands = active.flatMap(value => value.commands);
  const commandIds = new Set<string>();
  for (const command of commands) {
    if (commandIds.has(command.id)) throw new Error(`Duplicate command: ${command.id}`);
    commandIds.add(command.id);
  }
  const latest = useRef(commands);
  latest.current = commands;
  useLayoutEffect(() => () => { latest.current = []; }, []);
  const value: PluginContextValue = {
    commands: commands.map(command => ({ ...command, run: () => {
      const current = latest.current.find(candidate => candidate.id === command.id);
      if (current && !current.disabled) current.run();
    } })),
    overlays: { items: active.filter(item => item.overlay !== undefined).map(item => <Fragment key={item.id}>{item.overlay}</Fragment>), blocking: active.some(item => item.blocking) },
  };
  return <PluginContext.Provider value={value}>
    {plugins.map(plugin => <PluginInstance key={plugin.id} plugin={plugin} host={host} register={register} />)}
    {children}
  </PluginContext.Provider>;
}

// Registry publication must not itself rerender the plugin hook scope.
const PluginInstance = memo(function PluginInstance({ plugin, host, register }: {
  plugin: WebPlugin<ReactNode>;
  host: WebPluginHost;
  register(id: string, value?: Contributions): void;
}) {
  const contributions = plugin.useContributions(host);
  for (const command of contributions.commands)
    if (!command.id.startsWith(`${plugin.id}.`)) throw new Error(`Command ${command.id} must use the ${plugin.id} namespace.`);
  if (new Set(contributions.commands.map(command => command.id)).size !== contributions.commands.length)
    throw new Error(`Duplicate command in plugin: ${plugin.id}`);
  useLayoutEffect(() => { register(plugin.id, contributions); });
  useLayoutEffect(() => () => register(plugin.id), [plugin.id, register]);
  return null;
});

export function usePluginCommands(placement: CommandPlacement): readonly PluginCommand[] {
  const { commands } = useContext(PluginContext);
  return useMemo(() => commands.filter(command => command.placements.includes(placement)), [commands, placement]);
}

export function usePluginOverlays() {
  return useContext(PluginContext).overlays;
}

export function PluginOverlayOutlet() {
  return <>{usePluginOverlays().items}</>;
}
