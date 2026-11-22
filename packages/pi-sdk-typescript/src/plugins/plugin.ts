import type { CancellationSignal } from "../platform.js";
import type { PluginUI } from "./plugin-ui.js";
import { assertIdentifier, type RemoteContract, type RemoteContractImplementation } from "./remote-contract.js";

export type PluginCleanup = () => void | Promise<void>;

export interface HostPluginContext {
  readonly signal: CancellationSignal;
  provide<C extends RemoteContract>(contract: C, implementation: RemoteContractImplementation<C>): void;
  onCleanup(cleanup: PluginCleanup): void;
}

export interface HostPluginEntry {
  setup(context: HostPluginContext): void | Promise<void>;
}

export type PluginEntryLoader<Entry> = () => Promise<Entry>;

export interface Plugin<View = unknown> {
  readonly id: string;
  readonly provides?: readonly RemoteContract[];
  readonly requires?: readonly RemoteContract[];
  readonly host?: PluginEntryLoader<HostPluginEntry>;
  /** UI contributions share the plugin identity; the application owns composition. */
  readonly web?: PluginEntryLoader<PluginUI<View>>;
}

/** Describe a built-in without loading or activating either environment. */
export function definePlugin<View, const P extends Plugin<View>>(definition: P & Plugin<View>): P {
  assertIdentifier(definition.id, "plugin");
  if (!definition.host && !definition.web) throw new Error("A plugin needs at least one entry.");

  for (const entry of [definition.host, definition.web])
    if (entry !== undefined && typeof entry !== "function") throw new Error("Plugin entries must be lazy loader functions.");

  for (const contracts of [definition.provides, definition.requires]) {
    const ids = new Set<string>();

    for (const contract of contracts ?? []) {
      assertIdentifier(contract.id, "contract");
      if (ids.has(contract.id)) throw new Error(`Duplicate contract: ${contract.id}`);
      ids.add(contract.id);
    }
  }

  for (const contract of definition.provides ?? [])
    if (contract.id !== definition.id && !contract.id.startsWith(`${definition.id}.`))
      throw new Error(`Provided contract ${contract.id} must use the ${definition.id} namespace.`);

  return Object.freeze({
    ...definition,
    ...(definition.provides && { provides: Object.freeze([...definition.provides]) }),
    ...(definition.requires && { requires: Object.freeze([...definition.requires]) }),
  }) as P;
}
