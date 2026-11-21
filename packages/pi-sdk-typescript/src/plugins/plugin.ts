import type { CancellationSignal } from "../platform.js";
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

/** The embedding web application owns this context and activation. */
export interface PluginEntry<Context = never> {
  setup: (context: Context) => void | Promise<void>;
}

export type PluginEntryLoader<Entry = PluginEntry> = () => Promise<Entry>;

export interface PluginDefinition<WebContext = never> {
  readonly id: string;
  readonly provides?: readonly RemoteContract[];
  readonly requires?: readonly RemoteContract[];
  readonly host?: PluginEntryLoader<HostPluginEntry>;
  readonly web?: PluginEntryLoader<PluginEntry<WebContext>>;
}

/** Describe a built-in without loading or activating either environment. */
export function definePlugin<const P extends PluginDefinition>(definition: P): P {
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
