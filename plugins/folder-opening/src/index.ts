import { z } from "zod";
import { directoryBrowseSchema, directoryListingSchema } from "@manuelselch/pi-sdk/protocol";
import { defineRemoteContract, type RemoteContractClient } from "@manuelselch/pi-sdk/plugins";

export const folderBrowseResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), listing: directoryListingSchema }),
  z.object({ ok: z.literal(false), error: z.object({
    code: z.enum(["invalidPath", "notFound", "permissionDenied", "listingChanged", "operationFailed"]),
    message: z.string().min(1).max(512),
  }) }),
]);

/** Read-only server folder browsing; session creation remains an application action. */
export const folderOpeningContract = defineRemoteContract({
  id: "folder-opening",
  version: 1,
  methods: {
    browse: { input: directoryBrowseSchema, output: folderBrowseResultSchema },
  },
});

export type FolderBrowseResult = ReturnType<typeof folderBrowseResultSchema.parse>;
export type FolderOpeningContract = RemoteContractClient<typeof folderOpeningContract>;
