import { SDKError, type PiClient } from "@manuelselch/pi-sdk";
import { folderOpeningContract } from "../../contract.js";
import type { DirectoryBrowse } from "@manuelselch/pi-sdk/protocol";

type ClientRequest = <T>(invoke: (client: PiClient) => Promise<T>) => Promise<T>;

/** Resolve the current SDK client on every request, never capture a connection. */
export function createFolderClient(request: ClientRequest) {
  return {
    browseDirectories: (query: DirectoryBrowse, signal?: AbortSignal) => request(async client => {
      const result = await client.plugin(folderOpeningContract).browse(query, { signal });
      if (!result.ok) throw new SDKError(result.error.code, result.error.message, "rejected");
      return result.listing;
    }),
  };
}
