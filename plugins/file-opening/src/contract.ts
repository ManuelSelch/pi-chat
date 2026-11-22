import { z } from "zod";
import { idSchema, filePathSchema, fileOpenResultSchema } from "@manuelselch/pi-sdk/protocol";
import { defineRemoteContract, type RemoteContractClient } from "@manuelselch/pi-sdk/plugins";

// Reuse existing validators; no new wire route is registered.
export { filePathSchema, fileOpenErrorCodeSchema, fileOpenResultSchema } from "@manuelselch/pi-sdk/protocol";
export type { FileOpenErrorCode, FileOpenResult } from "@manuelselch/pi-sdk/protocol";

/** Declarative only. Success means OS acceptance, not a displayed window. */
export const fileOpeningContract = defineRemoteContract({
  id: "file-opening",
  version: 1,
  methods: {
    open: {
      input: z.object({ sessionId: idSchema, path: filePathSchema }),
      output: fileOpenResultSchema,
    },
  },
});

/** Explicit runtime identity and server-local path; never use browser selection. */
export type OpenFileInput = ReturnType<typeof fileOpeningContract.methods.open.input.parse>;
export type FileOpeningContract = RemoteContractClient<typeof fileOpeningContract>;
