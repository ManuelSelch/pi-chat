import type { CancellationSignal } from "../platform.js";

export interface RemoteCallOptions { signal?: CancellationSignal }

/** Structural validator interface; Zod schemas work without a framework dependency. */
export interface ValueSchema<T = unknown> {
  parse(value: unknown): T;
}

export interface RemoteMethod {
  readonly input: ValueSchema;
  readonly output: ValueSchema;
}

export interface RemoteContract<Methods extends Readonly<Record<string, RemoteMethod>> = Readonly<Record<string, RemoteMethod>>> {
  readonly id: string;
  /** Exact contract revision, independent of package and transport versions. */
  readonly version: number;
  readonly methods: Methods;
}

/** Async contract client shape; defining a contract does not implement calls. */
export type RemoteContractClient<C extends RemoteContract> = {
  readonly [M in keyof C["methods"]]: (
    input: ReturnType<C["methods"][M]["input"]["parse"]>,
    options?: RemoteCallOptions,
  ) => Promise<ReturnType<C["methods"][M]["output"]["parse"]>>;
};

/** Host handlers may return a validated result synchronously or asynchronously. */
export type RemoteContractImplementation<C extends RemoteContract> = {
  readonly [M in keyof C["methods"]]: (
    input: ReturnType<C["methods"][M]["input"]["parse"]>,
  ) => ReturnType<C["methods"][M]["output"]["parse"]> | Promise<ReturnType<C["methods"][M]["output"]["parse"]>>;
};

export function assertIdentifier(id: string, kind: string): void {
  if (typeof id !== "string" || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(id))
    throw new Error(`Invalid ${kind} id: ${id}`);
}

/** Declare methods only; event streams and state replication are outside this MVP. */
export function defineRemoteContract<const C extends RemoteContract>(definition: C): C {
  assertIdentifier(definition.id, "contract");
  if (!Number.isSafeInteger(definition.version) || definition.version < 1)
    throw new Error("Contract version must be a positive safe integer.");
  const entries = Object.entries(definition.methods);
  if (!entries.length) throw new Error("A remote contract needs at least one method.");
  const methods = Object.fromEntries(entries.map(([name, method]) => {
    assertIdentifier(name, "method");
    if (typeof method?.input?.parse !== "function" || typeof method?.output?.parse !== "function")
      throw new Error(`Method ${name} needs input and output schemas with parse functions.`);
    return [name, Object.freeze({ ...method })];
  }));
  // Each method retains its original schemas and therefore its inferred types.
  return Object.freeze({ ...definition, methods: Object.freeze(methods) }) as C;
}
