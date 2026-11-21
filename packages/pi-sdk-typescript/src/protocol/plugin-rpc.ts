import { z } from "zod";

const identifier = z.string().max(128).regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/);

/** Server-scoped plugin RPC; uses the ordinary v2 request/response envelope. */
export const pluginCallParamsSchema = z.object({
  contractId: identifier,
  contractVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  method: identifier,
  input: z.json(),
});
export const pluginCallResultSchema = z.object({ value: z.json() });
