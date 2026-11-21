import { SDKError, type PiClient } from "@manuelselch/pi-sdk";
import { fileOpeningContract } from "@manuelselch/pi-sdk/plugins/file-opening";
import { createPendingFileOpens } from "./pending-opens.js";

type ClientRequest = <T>(invoke: (client: PiClient) => Promise<T>) => Promise<T>;

/** App-composed browser entry; Server owns host activation. */
export function createFileOpeningPlugin(request: ClientRequest) {
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
