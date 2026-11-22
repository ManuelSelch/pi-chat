import { SDKError, type PiClient } from "@manuelselch/pi-sdk";
import { fileOpeningContract } from "../contract.js";
import { createPendingFileOpens } from "./pending-opens.js";

type ClientRequest = <T>(invoke: (client: PiClient) => Promise<T>) => Promise<T>;

/** App-composed browser actions, not a plugin declaration; Server owns host activation. */
export function createFileOpeningActions(request: ClientRequest) {
  const actions = new WeakMap<PiClient, ReturnType<typeof createPendingFileOpens>>();

  return {
    openFile: (sessionId: string, path: string): Promise<void> => request(client => {
      let open = actions.get(client);
      if (!open) {
        open = createPendingFileOpens(client, async input => {
          const result = await client.plugin(fileOpeningContract).open(input);
          if (!result.ok) throw new SDKError(result.error.code, result.error.message, "rejected");
        });
        actions.set(client, open);
      }
      return open(sessionId, path);
    }),
  };
}
