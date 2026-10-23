import { z } from "zod";
import { directoryBrowseSchema, directoryListingSchema } from "./directories.js";
import { filePathSchema } from "./files.js";
import {
  bashMessageSchema, toolCardSchema, skillInvocationSchema, thinkingLevelSchema, chatMessageSchema,
  projectCatalogueSchema, slashCommandSchema, commandCompletionItemSchema,
} from "./models.js";

/** Authoritative v2 wire contract. No v1 negotiation or compatibility path. */
export const VERSION = 2 as const;
export const idSchema = z.string().min(1).max(128).regex(/^[^\u0000-\u001f\u007f-\u009f]+$/);
export const counterSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const capabilitySchema = z.enum(["presentation", "directory.browse", "command.complete", "session.archive", "project.pin", "project.remove", "file.open", "server.restart"]);
export type Capability = z.infer<typeof capabilitySchema>;
export const errorSchema = z.object({ code: z.string().min(1).max(128), message: z.string().min(1), details: z.json().optional() });
export type ProtocolError = z.infer<typeof errorSchema>;
export type JsonValue = z.infer<ReturnType<typeof z.json>>;
export const promptSchema = z.discriminatedUnion("kind", [
  z.object({ id: idSchema, title: z.string(), kind: z.literal("select"), options: z.array(z.string()) }),
  z.object({ id: idSchema, title: z.string(), kind: z.literal("confirm"), message: z.string() }),
  z.object({ id: idSchema, title: z.string(), kind: z.literal("input"), placeholder: z.string().optional() }),
  z.object({ id: idSchema, title: z.string(), kind: z.literal("editor"), prefill: z.string().optional() }),
]);
export const promptResultSchema = z.discriminatedUnion("cancelled", [
  z.object({ cancelled: z.literal(true) }),
  z.object({ cancelled: z.literal(false), value: z.union([z.string(), z.boolean()]) }),
]);
// Presentation hints are open strings: clients ignore unsupported placements,
// slots/styles rather than rejecting the required session state containing them.
const hint = z.string().min(1).max(128);
const v2ToolCardSchema = toolCardSchema.extend({ toolCallId: idSchema });
export const extensionsSchema = z.object({
  buttons: z.array(z.object({ id: idSchema, slot: hint, label: z.string().min(1), icon: z.string().optional(), actionId: idSchema })),
  badges: z.array(z.object({ id: idSchema, slot: hint, label: z.string().min(1), tone: hint })),
  state: z.record(z.string(), z.json()),
});
export const presentationSchema = z.object({
  revision: counterSchema,
  widgets: z.array(z.object({ key: idSchema, lines: z.array(z.string()), placement: hint })),
  footer: z.array(z.object({ key: idSchema, text: z.string().min(1), align: hint, variant: hint })),
  extensions: extensionsSchema,
});
export const settingsSchema = z.object({
  model: z.string(), availableModels: z.array(z.string()), thinkingLevel: thinkingLevelSchema, availableThinkingLevels: z.array(thinkingLevelSchema),
});
export const runtimeSchema = z.object({ status: z.enum(["idle", "running", "aborting", "closing"]), runId: idSchema.optional(), lastError: z.string().optional() });
// Browser-local notices are not authoritative history and never cross v2 wire.
export const messageSchema = z.discriminatedUnion("role", [
  z.object({ ...bashMessageSchema.shape, id: idSchema, timestamp: z.number().finite().nonnegative().optional() }),
  z.object({ id: idSchema, role: z.enum(["user", "assistant", "system"]), text: z.string(), thinking: z.string().optional(), skill: skillInvocationSchema.optional(), timestamp: z.number().finite().nonnegative().optional() }),
  z.object({ id: idSchema, role: z.literal("tool"), tool: v2ToolCardSchema, timestamp: z.number().finite().nonnegative().optional() }),
  z.object({ id: idSchema, role: z.literal("custom"), customType: z.string().min(1), text: z.string(), timestamp: z.number().finite().nonnegative().optional() }),
]);
export const summarySchema = z.object({ sessionId: idSchema, title: z.string(), sessionPath: z.string().min(1).optional(), projectPath: z.string(), projectName: z.string(), status: z.enum(["idle", "running", "blocked", "closing"]) });
export const snapshotSchema = z.object({
  sessionId: idSchema, throughSequence: counterSchema, sessionPath: z.string().min(1).optional(), sessionName: z.string().optional(), projectPath: z.string(),
  messages: z.array(messageSchema), runtime: runtimeSchema, steeringMessages: z.array(z.string()), settings: settingsSchema,
  commands: z.array(slashCommandSchema), prompts: z.array(promptSchema), presentation: presentationSchema.optional(),
});
export type SessionSnapshot = z.infer<typeof snapshotSchema>;
export type OpenSessionSummary = z.infer<typeof summarySchema>;
export type SessionSettings = z.infer<typeof settingsSchema>;
export const inventorySchema = z.object({ revision: counterSchema, sessions: z.array(summarySchema) });
export const projectsSchema = z.object({ revision: counterSchema, catalogue: projectCatalogueSchema });
export const completedSchema = z.object({ state: z.literal("completed") });
export const acceptedSchema = z.object({ state: z.literal("accepted"), operationId: idSchema });
const openedSchema = z.object({ summary: summarySchema, snapshot: snapshotSchema });
export const initializeResultSchema = z.object({
  protocolVersion: z.literal(VERSION), serverVersion: z.string().min(1), serverInstanceId: idSchema, connectionId: idSchema,
  capabilities: z.array(capabilitySchema), inventory: inventorySchema, projects: projectsSchema, snapshots: z.array(snapshotSchema),
});

const empty = z.object({});
function server<P extends z.ZodType, R extends z.ZodType>(params: P, result: R, capability?: Capability) { return { scope: "server" as const, params, result, capability }; }
function session<P extends z.ZodType, R extends z.ZodType>(params: P, result: R, capability?: Capability) { return { scope: "session" as const, params, result, capability }; }
export const operationSchemas = {
  "server.initialize": server(z.object({ client: z.object({ name: z.string().min(1).max(128), version: z.string().min(1).max(128) }), capabilities: z.array(z.string().min(1).max(128)).max(32).default([]) }), initializeResultSchema),
  "server.ping": server(empty, completedSchema),
  "server.restart": server(empty, acceptedSchema, "server.restart"),
  "session.create": server(z.object({ projectPath: z.string().min(1).optional() }), openedSchema),
  "session.open": server(z.object({ sessionPath: z.string().min(1) }), openedSchema),
  "session.list": server(empty, inventorySchema),
  "session.snapshot": session(empty, snapshotSchema),
  "session.close": session(empty, completedSchema),
  "session.compact": session(empty, acceptedSchema),
  "session.reload": session(empty, acceptedSchema),
  "session.archive": server(z.object({ path: z.string().min(1), archived: z.boolean() }), completedSchema, "session.archive"),
  "project.list": server(empty, projectsSchema),
  "project.pin": server(z.object({ path: z.string().min(1), pinned: z.boolean() }), completedSchema, "project.pin"),
  "project.remove": server(z.object({ path: z.string().min(1) }), completedSchema, "project.remove"),
  "message.send": session(z.object({ message: z.string().trim().min(1).max(1_048_576) }), acceptedSchema),
  "run.abort": session(empty, z.union([acceptedSchema, completedSchema])),
  "prompt.answer": session(z.object({ promptId: idSchema, result: promptResultSchema }), completedSchema),
  "model.select": session(z.object({ model: z.string().min(1) }), settingsSchema),
  "thinking.level": session(z.object({ level: thinkingLevelSchema }), settingsSchema),
  "extension.run": session(z.object({ actionId: idSchema }), acceptedSchema),
  "directory.browse": server(directoryBrowseSchema, directoryListingSchema, "directory.browse"),
  "command.complete": session(z.object({ commandName: z.string().min(1), argumentPrefix: z.string() }), z.object({ items: z.array(commandCompletionItemSchema) }), "command.complete"),
  "file.open": session(z.object({ path: filePathSchema }), completedSchema, "file.open"),
} as const;
export type Method = keyof typeof operationSchemas;
export type Params<M extends Method> = z.input<(typeof operationSchemas)[M]["params"]>;
export type Result<M extends Method> = z.output<(typeof operationSchemas)[M]["result"]>;
export type Request<M extends Method = Method> = { [K in M]: {
  version: 2; type: "request"; requestId: string; method: K; params: z.output<(typeof operationSchemas)[K]["params"]>;
} & ((typeof operationSchemas)[K]["scope"] extends "session" ? { sessionId: string } : { sessionId?: never }) }[M];

const requestBase = { version: z.literal(VERSION), type: z.literal("request"), requestId: idSchema };
const requests = Object.entries(operationSchemas).map(([method, spec]) => z.object({
  ...requestBase, method: z.literal(method), params: spec.params,
  sessionId: spec.scope === "session" ? idSchema : z.never().optional(),
}));
export const requestSchema = z.discriminatedUnion("method", requests as [typeof requests[number], ...typeof requests[number][]]) as z.ZodType<Request>;
const responseBase = { version: z.literal(VERSION), type: z.literal("response"), requestId: idSchema };
export const responseSchema = z.discriminatedUnion("ok", [
  z.object({ ...responseBase, ok: z.literal(true), result: z.json(), error: z.never().optional() }),
  z.object({ ...responseBase, ok: z.literal(false), error: errorSchema, result: z.never().optional() }),
]);
export type Response<M extends Method> = { version: 2; type: "response"; requestId: string } & ({ ok: true; result: Result<M> } | { ok: false; error: ProtocolError });
export function parseResponse<M extends Method>(method: M, input: unknown): Response<M> {
  const response = responseSchema.parse(input);
  if (!response.ok) return response;
  return { ...response, result: operationSchemas[method].result.parse(response.result) } as Response<M>;
}

const eventBase = { version: z.literal(VERSION), type: z.literal("event"), serverInstanceId: idSchema };
const sequenced = { ...eventBase, sessionId: idSchema, sequence: counterSchema };
function core<N extends string, S extends z.ZodType>(event: N, data: S) { return z.object({ ...sequenced, event: z.literal(event), data }); }
function global<N extends string, S extends z.ZodType>(event: N, data: S) { return z.object({ ...eventBase, sessionId: z.never().optional(), sequence: z.never().optional(), event: z.literal(event), data }); }
export const eventSchema = z.discriminatedUnion("event", [
  z.object({ ...eventBase, event: z.literal("session.snapshot"), sessionId: idSchema, sequence: z.never().optional(), data: snapshotSchema }),
  z.object({ ...eventBase, event: z.literal("presentation.changed"), sessionId: idSchema, sequence: z.never().optional(), data: presentationSchema }),
  core("runtime.status", runtimeSchema),
  core("session.closed", z.object({ reason: z.enum(["requested", "archived", "shutdown", "replaced"]) })),
  global("session.list.changed", inventorySchema),
  global("session.replaced", z.object({ previousSessionId: idSchema, snapshot: snapshotSchema })),
  global("server.stopping", z.object({ reason: z.enum(["shutdown", "restart"]) })),
  core("message.delta", z.object({ runId: idSchema, delta: z.string() })),
  core("message.thinking.delta", z.object({ runId: idSchema, delta: z.string() })),
  core("message.finalized", z.object({ runId: idSchema, message: messageSchema })),
  core("tool.updated", z.object({ runId: idSchema, tool: v2ToolCardSchema })),
  core("steering.queue.changed", z.object({ messages: z.array(z.string()) })),
  core("settings.changed", settingsSchema),
  core("operation.finished", z.discriminatedUnion("outcome", [
    z.object({ operationId: idSchema, requestId: idSchema, outcome: z.literal("completed") }),
    z.object({ operationId: idSchema, requestId: idSchema, outcome: z.literal("aborted") }),
    z.object({ operationId: idSchema, requestId: idSchema, outcome: z.literal("failed"), error: errorSchema }),
  ])),
  core("notification.created", z.object({ level: z.enum(["info", "warning", "error"]), message: z.string() })),
  core("prompt.list.changed", z.object({ prompts: z.array(promptSchema) })),
  global("project.list.changed", projectsSchema),
]);
export type Event = z.infer<typeof eventSchema>;
export const protocolErrorSchema = z.object({ ...eventBase, type: z.literal("protocolError"), error: errorSchema });
export const serverMessageSchema = z.union([responseSchema, eventSchema, protocolErrorSchema]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
