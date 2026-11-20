import { definePlugin, type HostPluginContext, type PluginCleanup, type PluginDefinition } from "@manuelselch/pi-sdk/plugins";
import type { RemoteContract, RemoteContractClient } from "@manuelselch/pi-sdk/plugins";

export interface PluginRuntime {
  start(): Promise<void>;
  dispose(): Promise<void>;
  client<C extends RemoteContract>(contract: C): RemoteContractClient<C>;
}

type RuntimeState = "idle" | "starting" | "active" | "failed" | "disposing" | "disposed";
interface Activation {
  controller: AbortController;
  cleanups: PluginCleanup[];
}
interface Provider {
  contract: RemoteContract;
  handlers: ReadonlyMap<string, (input: unknown) => unknown>;
}

/** An isolated, one-shot host runtime. No network, web activation or global registry. */
export function createPluginRuntime(definitions: readonly PluginDefinition[]): PluginRuntime {
  const plugins = definitions.map(definition => definePlugin(definition));
  const ids = new Set<string>();
  for (const plugin of plugins) {
    if (ids.has(plugin.id)) throw new Error(`Duplicate plugin: ${plugin.id}`);
    ids.add(plugin.id);
  }

  const providers = new Map<string, Provider>();
  const activations: Activation[] = [];
  let state: RuntimeState = "idle";
  let starting: Promise<void> | undefined;
  let disposing: Promise<void> | undefined;
  let cleaning: Promise<void> | undefined;

  function withdraw(): void {
    providers.clear();
    for (const activation of activations) activation.controller.abort();
  }

  function cleanup(): Promise<void> {
    return cleaning ??= Promise.resolve().then(async () => {
      const errors: unknown[] = [];
      for (const activation of [...activations].reverse()) {
        for (const release of activation.cleanups.splice(0).reverse()) {
          try { await release(); }
          catch (error) { errors.push(error); }
        }
      }
      if (errors.length) throw new AggregateError(errors, "Plugin cleanup failed.");
    });
  }

  function contextFor(plugin: PluginDefinition, activation: Activation): HostPluginContext {
    const assertAlive = () => {
      if (activation.controller.signal.aborted) throw new Error(`Plugin activation ended: ${plugin.id}`);
    };
    return Object.freeze({
      signal: activation.controller.signal,
      provide(contract, implementation) {
        assertAlive();
        const declared = plugin.provides?.find(item => item.id === contract.id && item.version === contract.version);
        if (!declared) throw new Error(`Contract ${contract.id} version ${contract.version} is not declared by ${plugin.id}.`);
        if (providers.has(contract.id)) throw new Error(`Duplicate provider: ${contract.id}`);

        const handlers = new Map<string, (input: unknown) => unknown>();
        for (const name of Object.keys(declared.methods)) {
          const handler = (implementation as Record<string, unknown>)[name];
          if (!Object.hasOwn(implementation, name) || typeof handler !== "function")
            throw new Error(`Missing implementation for ${contract.id}.${name}`);
          handlers.set(name, input => handler.call(implementation, input));
        }
        providers.set(contract.id, { contract: declared, handlers });
      },
      onCleanup(release) {
        assertAlive();
        if (typeof release !== "function") throw new Error("Plugin cleanup must be a function.");
        activation.cleanups.push(release);
      },
    } satisfies HostPluginContext);
  }

  async function activate(): Promise<void> {
    try {
      for (const plugin of plugins) {
        if (state !== "starting") throw new Error("Plugin startup aborted.");
        if (!plugin.host) continue;

        const activation: Activation = { controller: new AbortController(), cleanups: [] };
        activations.push(activation);
        const entry = await plugin.host();
        if (activation.controller.signal.aborted) throw new Error("Plugin startup aborted.");
        await entry.setup(contextFor(plugin, activation));
        if (activation.controller.signal.aborted) throw new Error("Plugin startup aborted.");
      }
      if (state !== "starting") throw new Error("Plugin startup aborted.");

      // Readiness validation, not dependency sorting: setups run in caller order.
      for (const plugin of plugins.filter(item => item.host)) {
        for (const required of plugin.requires ?? []) {
          const provider = providers.get(required.id);
          if (!provider || provider.contract.version !== required.version)
            throw new Error(`Required contract unavailable: ${required.id} version ${required.version} for ${plugin.id}`);
        }
      }
      state = "active";
    } catch (error) {
      if (state !== "disposing") state = "failed";
      withdraw();
      try { await cleanup(); }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], "Plugin startup and cleanup failed."); }
      throw error;
    }
  }

  function assertAvailable(id: string, provider: Provider): void {
    if (state !== "active" || providers.get(id) !== provider)
      throw new Error(`Contract unavailable: ${id}`);
  }

  return {
    start() {
      if (state === "failed" || state === "disposing" || state === "disposed")
        return Promise.reject(new Error(`Plugin runtime cannot start while ${state}.`));
      if (starting) return starting;

      state = "starting";
      return starting = Promise.resolve().then(activate);
    },
    dispose() {
      if (disposing) return disposing;

      state = "disposing";
      disposing = Promise.resolve().then(async () => {
        try {
          // Cooperative shutdown waits for loading/setup before running cleanups.
          await starting?.catch(() => undefined);
          await cleanup();
        } finally { state = "disposed"; }
      });
      withdraw();
      return disposing;
    },
    client<C extends RemoteContract>(contract: C): RemoteContractClient<C> {
      const methods = Object.keys(contract.methods).map(name => [name, async (input: unknown) => {
        if (state !== "active") throw new Error("Plugin runtime is not active.");
        const provider = providers.get(contract.id);
        if (!provider) throw new Error(`Contract unavailable: ${contract.id}`);
        if (provider.contract.version !== contract.version) throw new Error(`Contract version mismatch: ${contract.id}`);
        const method = Object.hasOwn(provider.contract.methods, name) ? provider.contract.methods[name] : undefined;
        const handler = provider.handlers.get(name);
        if (!method || !handler) throw new Error(`Contract method unavailable: ${contract.id}.${name}`);

        const argument = method.input.parse(input);
        assertAvailable(contract.id, provider);
        const result = await handler(argument);
        assertAvailable(contract.id, provider);
        const output = method.output.parse(result);
        assertAvailable(contract.id, provider);
        return output;
      }]);
      // Methods are built from this token; provider schemas validate erased values.
      return Object.freeze(Object.fromEntries(methods)) as RemoteContractClient<C>;
    },
  };
}
