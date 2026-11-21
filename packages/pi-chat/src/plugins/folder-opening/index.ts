import { SDKError, type PiClient } from "@manuelselch/pi-sdk";
import { folderOpeningContract } from "@manuelselch/pi-sdk/plugins/folder-opening";
import type { DirectoryBrowse } from "@manuelselch/pi-sdk/protocol";

export { FolderPicker } from "./components/FolderPicker.js";

type ClientRequest = <T>(invoke: (client: PiClient) => Promise<T>) => Promise<T>;

/** App-composed browser entry; session creation remains the application's action. */
export function createFolderOpeningPlugin(request: ClientRequest) {
  return {
    browseDirectories: (query: DirectoryBrowse, signal?: AbortSignal) => request(async client => {
      const result = await client.plugin(folderOpeningContract).browse(query, { signal });
      if (!result.ok) throw new SDKError(result.error.code, result.error.message, "rejected");
      return result.listing;
    }),
  };
}
