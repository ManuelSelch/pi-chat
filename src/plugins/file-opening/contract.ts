import { idSchema, operationSchemas, fileOpenResultSchema } from "@manuelselch/pi-sdk/protocol";
import { defineRemoteContract, type RemoteContractClient } from "../sdk/index.js";

// Reuse existing validators; no new wire route is registered.
export { filePathSchema, fileOpenErrorCodeSchema, fileOpenResultSchema } from "@manuelselch/pi-sdk/protocol";
export type { FileOpenErrorCode, FileOpenResult } from "@manuelselch/pi-sdk/protocol";

/** Declarative only. Success means OS acceptance, not a displayed window. */
export const fileOpeningContract = defineRemoteContract({
  id: "file-opening",
  version: 1,
  methods: {
    open: {
      input: operationSchemas["file.open"].params.extend({ sessionId: idSchema }),
      output: fileOpenResultSchema,
    },
  },
});

/** Explicit runtime identity and server-local path; never use browser selection. */
export type OpenFileInput = ReturnType<typeof fileOpeningContract.methods.open.input.parse>;
export type FileOpeningContract = RemoteContractClient<typeof fileOpeningContract>;
