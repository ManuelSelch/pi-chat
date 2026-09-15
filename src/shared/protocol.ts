import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;

/**
 * Close code the server uses when a newer browser takes the single controller
 * slot. The displaced client must not reconnect automatically: both tabs would
 * keep kicking each other in a loop.
 */
export const CONTROLLER_REPLACED_CODE = 4001;

/**
 * Compact representation of one Pi tool call, correlated by `toolCallId`.
 * Ids are deterministic (`tool:<toolCallId>`) so a live event and a snapshot
 * rebuilt from session history produce the same entry rather than two cards.
 */
export const toolCardSchema = z.object({
  toolCallId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["running", "success", "error"]),
  argsText: z.string().optional(),
  outputText: z.string().optional(),
});

export type ToolCard = z.infer<typeof toolCardSchema>;

export const chatMessageSchema = z.discriminatedUnion("role", [
  z.object({
    id: z.string().min(1),
    role: z.enum(["user", "assistant", "system"]),
    text: z.string(),
    timestamp: z.number().optional(),
  }),
  z.object({
    id: z.string().min(1),
    role: z.literal("tool"),
    tool: toolCardSchema,
    timestamp: z.number().optional(),
  }),
  /** Displayable extension-injected message from `pi.sendMessage()`. */
  z.object({
    id: z.string().min(1),
    role: z.literal("custom"),
    customType: z.string().min(1),
    text: z.string(),
    timestamp: z.number().optional(),
  }),
  /** Extension output from `ctx.ui.notify`, e.g. the result of a slash command. */
  z.object({
    id: z.string().min(1),
    role: z.literal("notice"),
    level: z.enum(["info", "warning", "error"]),
    text: z.string(),
    /**
     * How many real messages preceded this notice. A notice is client-only, so
     * an authoritative snapshot has to put it back where it was said rather
     * than at the end, which made old output look like a new notification.
     */
    anchor: z.number().int().nonnegative().optional(),
    timestamp: z.number().optional(),
  }),
]);

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const sessionNameSourceSchema = z.enum(["manual", "auto", "none"]);
export type SessionNameSource = z.infer<typeof sessionNameSourceSchema>;

export const chatSessionSummarySchema = z.object({
  path: z.string().min(1),
  id: z.string().min(1),
  title: z.string().min(1),
  name: z.string().optional(),
  nameSource: sessionNameSourceSchema,
  firstMessage: z.string().optional(),
  modified: z.number(),
  created: z.number(),
  messageCount: z.number().int().nonnegative(),
});

export const chatProjectSummarySchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  exists: z.boolean(),
  modified: z.number(),
  sessionCount: z.number().int().nonnegative(),
  sessions: z.array(chatSessionSummarySchema),
});

export const projectCatalogueSchema = z.object({ projects: z.array(chatProjectSummarySchema) });
export type ChatSessionSummary = z.infer<typeof chatSessionSummarySchema>;
export type ChatProjectSummary = z.infer<typeof chatProjectSummarySchema>;
export type ProjectCatalogue = z.infer<typeof projectCatalogueSchema>;

export const thinkingLevelSchema = z.enum(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
export type ThinkingLevel = z.infer<typeof thinkingLevelSchema>;

// Discriminated by id, not kind: several features share the "select" shape.
export const webFeatureSchema = z.discriminatedUnion("id", [
  z.object({
    id: z.literal("session.rename"),
    group: z.literal("session"),
    kind: z.literal("form"),
    title: z.string(),
    description: z.string().optional(),
    state: z.object({ name: z.string() }),
  }),
  z.object({
    id: z.literal("thinking.level"),
    group: z.literal("model"),
    kind: z.literal("select"),
    title: z.string(),
    description: z.string().optional(),
    state: z.object({ value: thinkingLevelSchema, options: z.array(thinkingLevelSchema) }),
  }),
  z.object({
    id: z.literal("model.select"),
    group: z.literal("model"),
    kind: z.literal("select"),
    title: z.string(),
    description: z.string().optional(),
    state: z.object({ value: z.string(), options: z.array(z.string()) }),
  }),
  z.object({
    id: z.literal("session.compact"),
    group: z.literal("session"),
    kind: z.literal("action"),
    title: z.string(),
    description: z.string().optional(),
    state: z.object({ label: z.string() }),
  }),
  // Only advertised by a server that can actually replace itself, so the UI
  // never offers a restart that would leave nothing running.
  z.object({
    id: z.literal("app.restart"),
    group: z.literal("app"),
    kind: z.literal("action"),
    title: z.string(),
    description: z.string().optional(),
    state: z.object({ label: z.string() }),
  }),
]);

/**
 * A blocking question an extension asked through `ctx.ui`. The extension is
 * suspended on a promise until it is answered, so this is server state that
 * every snapshot must carry, not something the browser owns.
 */
export const uiPromptSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["select", "confirm", "input", "editor"]),
  title: z.string(),
  message: z.string().optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  prefill: z.string().optional(),
});

export type UiPrompt = z.infer<typeof uiPromptSchema>;

export const uiPromptResultSchema = z.union([
  z.object({ cancelled: z.literal(true) }),
  z.object({ cancelled: z.literal(false), value: z.union([z.string(), z.boolean()]) }),
]);

export type UiPromptResult = z.infer<typeof uiPromptResultSchema>;

/**
 * A panel an extension pushed with `ctx.ui.setWidget`, e.g. a todo overlay.
 *
 * Pi's RPC protocol defines widgets as plain lines of text, so an extension
 * written against that surface renders here without the web UI knowing anything
 * about it. Placement mirrors the terminal's, where the editor is the composer.
 */
export const widgetPlacementSchema = z.enum(["aboveEditor", "belowEditor"]);
export type WidgetPlacement = z.infer<typeof widgetPlacementSchema>;

export const widgetSchema = z.object({
  key: z.string().min(1),
  lines: z.array(z.string()),
  placement: widgetPlacementSchema,
});

export type Widget = z.infer<typeof widgetSchema>;

/**
 * A slash command Pi can dispatch. Typed UI actions stay the primary surface;
 * this catalogue is the generic fallback for everything else a session offers.
 */
export const slashCommandSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export type SlashCommand = z.infer<typeof slashCommandSchema>;

export const actionRegistrySchema = z.object({
  features: z.array(webFeatureSchema),
  commands: z.array(slashCommandSchema).default([]),
});
export type WebFeature = z.infer<typeof webFeatureSchema>;
export type ActionRegistry = z.infer<typeof actionRegistrySchema>;

export const piChatSlotSchema = z.enum(["session.header.right", "composer.right", "composer.below", "session.status", "settings.section"]);
export type PiChatSlot = z.infer<typeof piChatSlotSchema>;

export const piChatButtonSchema = z.object({
  id: z.string().min(1),
  slot: piChatSlotSchema,
  label: z.string().min(1),
  icon: z.string().optional(),
  actionId: z.string().min(1),
});
export type PiChatButton = z.infer<typeof piChatButtonSchema>;

/** Read-only status text an extension shows for this connection, e.g. a role. */
export const piChatBadgeSchema = z.object({
  id: z.string().min(1),
  slot: piChatSlotSchema,
  label: z.string().min(1),
  tone: z.enum(["neutral", "green", "yellow", "red"]).default("neutral"),
});
export type PiChatBadge = z.infer<typeof piChatBadgeSchema>;

export const piChatExtensionsSchema = z.object({
  buttons: z.array(piChatButtonSchema).default([]),
  badges: z.array(piChatBadgeSchema).default([]),
  state: z.record(z.string(), z.unknown()).default({}),
});
export type PiChatExtensions = z.infer<typeof piChatExtensionsSchema>;

export const tabStatusSchema = z.enum(["idle", "running", "blocked"]);
export type TabStatus = z.infer<typeof tabStatusSchema>;

/** One open session in the tab bar. Status drives the coloured dot. */
export const tabSchema = z.object({
  sessionId: z.string().min(1),
  title: z.string(),
  projectPath: z.string(),
  projectName: z.string(),
  status: tabStatusSchema,
});

export type Tab = z.infer<typeof tabSchema>;

const baseClientMessage = { version: z.literal(PROTOCOL_VERSION) };
/** Every session-scoped command names its tab: several sessions are live at once. */
const sessionScoped = { ...baseClientMessage, sessionId: z.string().min(1) };

export const clientMessageSchema = z.union([
  z.object({ ...sessionScoped, type: z.literal("prompt"), message: z.string().trim().min(1) }),
  z.object({ ...sessionScoped, type: z.literal("abort") }),
  z.object({
    ...sessionScoped,
    type: z.literal("uiPromptResponse"),
    promptId: z.string().min(1),
    result: uiPromptResultSchema,
  }),
  z.object({ ...baseClientMessage, type: z.literal("openProject"), path: z.string().min(1) }),
  z.object({ ...baseClientMessage, type: z.literal("openSession"), path: z.string().min(1) }),
  z.object({ ...baseClientMessage, type: z.literal("newSession"), path: z.string().min(1).optional() }),
  z.object({ ...baseClientMessage, type: z.literal("deleteSession"), path: z.string().min(1) }),
  z.object({ ...baseClientMessage, type: z.literal("closeTab"), sessionId: z.string().min(1) }),
  z.object({ ...baseClientMessage, type: z.literal("focusTab"), sessionId: z.string().min(1) }),
  z.object({ ...sessionScoped, type: z.literal("runFeature"), featureId: z.literal("session.rename"), input: z.object({ name: z.string().trim().min(1) }) }),
  z.object({ ...sessionScoped, type: z.literal("runFeature"), featureId: z.literal("thinking.level"), input: z.object({ level: thinkingLevelSchema }) }),
  z.object({ ...sessionScoped, type: z.literal("runFeature"), featureId: z.literal("model.select"), input: z.object({ model: z.string().min(1) }) }),
  z.object({ ...sessionScoped, type: z.literal("runFeature"), featureId: z.literal("session.compact"), input: z.object({}) }),
  z.object({ ...sessionScoped, type: z.literal("runFeature"), featureId: z.literal("app.restart"), input: z.object({}) }),
  z.object({ ...sessionScoped, type: z.literal("runExtensionAction"), actionId: z.string().min(1) }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

const sequenced = {
  version: z.literal(PROTOCOL_VERSION),
  /** Monotonic per session, so a busy tab cannot suppress a quiet one. */
  sequence: z.number().int().nonnegative(),
  sessionId: z.string().min(1),
};

export const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({
    ...sequenced,
    type: z.literal("snapshot"),
    throughSequence: z.number().int().nonnegative(),
    sessionPath: z.string().optional(),
    projectPath: z.string(),
    messages: z.array(chatMessageSchema),
    isStreaming: z.boolean(),
    /** How the last turn failed; absent once a new run starts. */
    lastError: z.string().optional(),
    catalogue: projectCatalogueSchema.optional(),
    actions: actionRegistrySchema.optional(),
    prompts: z.array(uiPromptSchema).optional(),
    widgets: z.array(widgetSchema).optional(),
    extensions: piChatExtensionsSchema.optional(),
  }),
  z.object({ ...sequenced, type: z.literal("prompts"), prompts: z.array(uiPromptSchema) }),
  z.object({ ...sequenced, type: z.literal("widgets"), widgets: z.array(widgetSchema) }),
  z.object({ ...sequenced, type: z.literal("assistantDelta"), runId: z.string(), delta: z.string() }),
  z.object({ ...sequenced, type: z.literal("messageFinal"), runId: z.string(), message: chatMessageSchema }),
  z.object({ ...sequenced, type: z.literal("toolEvent"), runId: z.string(), tool: toolCardSchema }),
  z.object({ ...sequenced, type: z.literal("runtimeStatus"), status: z.enum(["idle", "running", "aborting"]), error: z.string().optional() }),
  z.object({
    ...sequenced,
    type: z.literal("notification"),
    level: z.enum(["info", "warning", "error"]),
    message: z.string(),
  }),
  z.object({ ...baseClientMessage, type: z.literal("protocolError"), error: z.string() }),
  z.object({ ...baseClientMessage, type: z.literal("tabs"), tabs: z.array(tabSchema), activeSessionId: z.string() }),
  // Sent on its own because the home screen needs projects with no session open.
  // Also carries the app-level features, which the home screen cannot get from
  // a session snapshot because no session is open there.
  z.object({
    ...baseClientMessage,
    type: z.literal("catalogue"),
    catalogue: projectCatalogueSchema,
    features: z.array(webFeatureSchema).optional(),
  }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;

export function parseClientMessage(input: unknown): ClientMessage {
  return clientMessageSchema.parse(input);
}
