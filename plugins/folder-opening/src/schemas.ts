import { z } from "zod";
import { directoryListingSchema } from "@manuelselch/pi-sdk/protocol";

const folderBrowseErrorCodeSchema = z.enum([
  "invalidPath",
  "notFound",
  "permissionDenied",
  "listingChanged",
  "operationFailed",
]);

const folderBrowseErrorSchema = z.object({
  code: folderBrowseErrorCodeSchema,
  message: z.string().min(1).max(512),
});

const folderBrowseSuccessSchema = z.object({
  ok: z.literal(true),
  listing: directoryListingSchema,
});

const folderBrowseFailureSchema = z.object({
  ok: z.literal(false),
  error: folderBrowseErrorSchema,
});

export const folderBrowseResultSchema = z.discriminatedUnion("ok", [
  folderBrowseSuccessSchema,
  folderBrowseFailureSchema,
]);
