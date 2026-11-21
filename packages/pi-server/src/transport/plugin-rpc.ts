import type { RemoteContract, RemoteContractClient } from "@manuelselch/pi-sdk/plugins";
import { operationSchemas, type Params, type Result } from "@manuelselch/pi-sdk/protocol";
import type { PluginRuntime } from "../plugins/runtime.js";
import { V2OperationError } from "./v2-connection.js";

/** Explicit transport allowlist, separate from activation and the runtime's private registry. */
export class PluginRpc {
  private readonly contracts = new Map<string, { contract: RemoteContract; client: RemoteContractClient<RemoteContract> }>();

  constructor(runtime: PluginRuntime, contracts: readonly RemoteContract[]) {
    for (const contract of contracts) {
      if (this.contracts.has(contract.id)) throw new Error(`Duplicate RPC contract: ${contract.id}`);
      this.contracts.set(contract.id, { contract, client: runtime.client(contract) });
    }
  }

  get enabled(): boolean { return this.contracts.size > 0; }

  async call(params: Params<"plugin.call">): Promise<Result<"plugin.call">> {
    const exposed = this.contracts.get(params.contractId);
    if (!exposed) throw new V2OperationError("contractUnavailable", "Contract is not exposed.");
    if (exposed.contract.version !== params.contractVersion)
      throw new V2OperationError("contractVersionMismatch", "Contract revision does not match.");
    if (!Object.hasOwn(exposed.contract.methods, params.method))
      throw new V2OperationError("methodUnavailable", "Contract method is not exposed.");

    try {
      const value = await exposed.client[params.method]!(params.input);
      return operationSchemas["plugin.call"].result.parse({ value });
    } catch {
      // Never send handler/validator exceptions, paths, stack traces or arbitrary details.
      throw new V2OperationError("operationFailed", "Plugin call failed.");
    }
  }
}
