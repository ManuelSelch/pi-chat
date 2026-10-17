import { z } from "zod";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** Paths on the server machine, not URLs or commands. Preserve literal spelling. */
export const filePathSchema = z.string().min(1).max(4096).refine(
  (path) => path.trim().length > 0 && !CONTROL_CHARACTERS.test(path)
    && !URL_SCHEME.test(path) && !/^[\\/]{2}/.test(path),
  "Invalid file path",
);
export const fileRequestIdSchema = z.string().min(1).max(128).refine(
  (id) => id.trim().length > 0 && !CONTROL_CHARACTERS.test(id),
  "Invalid file request identifier",
);
export const fileOpenRequestSchema = z.object({
  sessionId: fileRequestIdSchema,
  requestId: fileRequestIdSchema,
  path: filePathSchema,
});
export type FileOpenRequest = z.infer<typeof fileOpenRequestSchema>;

export const fileOpenErrorCodeSchema = z.enum([
  "invalidPath", "sessionUnavailable", "notFound", "notFile", "permissionDenied", "unsupported", "openFailed",
]);
export type FileOpenErrorCode = z.infer<typeof fileOpenErrorCodeSchema>;

/** Success means the OS accepted the open, not that an application displayed it. */
export const fileOpenResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.object({
    code: fileOpenErrorCodeSchema,
    message: z.string().min(1).max(512),
  }) }),
]);
export type FileOpenResult = z.infer<typeof fileOpenResultSchema>;

