import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;

/**
 * Close code the server uses when a newer browser takes the single controller
 * slot. The displaced client must not reconnect automatically: both tabs would
 * keep kicking each other in a loop.
 */
export const CONTROLLER_REPLACED_CODE = 4001;

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant", "system"]),
  text: z.string(),
  timestamp: z.number().optional(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

const baseClientMessage = { version: z.literal(PROTOCOL_VERSION) };

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ ...baseClientMessage, type: z.literal("prompt"), message: z.string().trim().min(1) }),
  z.object({ ...baseClientMessage, type: z.literal("abort") }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

const sequenced = {
  version: z.literal(PROTOCOL_VERSION),
  sequence: z.number().int().nonnegative(),
};

export const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({
    ...sequenced,
    type: z.literal("snapshot"),
    throughSequence: z.number().int().nonnegative(),
    sessionId: z.string(),
    projectPath: z.string(),
    messages: z.array(chatMessageSchema),
    isStreaming: z.boolean(),
  }),
  z.object({ ...sequenced, type: z.literal("assistantDelta"), runId: z.string(), delta: z.string() }),
  z.object({ ...sequenced, type: z.literal("messageFinal"), runId: z.string(), message: chatMessageSchema }),
  z.object({ ...sequenced, type: z.literal("runtimeStatus"), status: z.enum(["idle", "running", "aborting"]), error: z.string().optional() }),
  z.object({ ...sequenced, type: z.literal("protocolError"), error: z.string() }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;

export function parseClientMessage(input: unknown): ClientMessage {
  return clientMessageSchema.parse(input);
}
