import { z } from "zod";


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
  writeContent: z.object({ text: z.string().max(102400), truncated: z.boolean() }).optional(),
  editDiff: z.object({
    format: z.enum(["unified", "pi-display"]),
    text: z.string().max(102400),
    truncated: z.boolean(),
    firstChangedLine: z.number().int().positive().optional(),
  }).optional(),
});

export type ToolCard = z.infer<typeof toolCardSchema>;

export const bashCardSchema = z.object({
  command: z.string(),
  output: z.string().max(20_000),
  status: z.enum(["running", "success", "error", "cancelled"]),
  exitCode: z.number().int().optional(),
  excludeFromContext: z.boolean(),
  truncated: z.boolean(),
  fullOutputPath: z.string().optional(),
});
export type BashCard = z.infer<typeof bashCardSchema>;
export const bashMessageSchema = z.object({
  id: z.string().min(1),
  role: z.literal("bash"),
  bash: bashCardSchema,
  timestamp: z.number().optional(),
});
export type BashMessage = z.infer<typeof bashMessageSchema>;

export const skillInvocationSchema = z.object({
  name: z.string().min(1), location: z.string().min(1), content: z.string(),
});
export type SkillInvocation = z.infer<typeof skillInvocationSchema>;

export const chatMessageSchema = z.discriminatedUnion("role", [
  bashMessageSchema,
  z.object({
    id: z.string().min(1),
    role: z.enum(["user", "assistant", "system"]),
    text: z.string(),
    /** SDK-expanded user skill instructions; text holds the appended task only. */
    skill: skillInvocationSchema.optional(),
    /**
     * The model's reasoning for this turn, when it reported any. Only ever set
     * for `assistant`. Carried on the message rather than streamed alone so it
     * survives a reload: snapshots are rebuilt from session history.
     */
    thinking: z.string().optional(),
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
  archivedAt: z.number().finite().nonnegative().optional(),
});

export const chatWorktreeSummarySchema = z.object({
  branch: z.string().min(1).optional(),
  commit: z.string().min(1).optional(),
  detached: z.boolean(),
  primary: z.boolean(),
});

export const chatProjectSummarySchema = z.object({
  path: z.string().min(1),
  displayPath: z.string().min(1),
  name: z.string().min(1),
  exists: z.boolean(),
  modified: z.number(),
  sessionCount: z.number().int().nonnegative(),
  pinned: z.boolean().optional(),
  quickChats: z.boolean().optional(),
  sessions: z.array(chatSessionSummarySchema),
  repositoryPath: z.string().min(1).optional(),
  repositoryName: z.string().min(1).optional(),
  worktree: chatWorktreeSummarySchema.optional(),
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
 * One entry of the composer footer, the browser's counterpart to the terminal's
 * footer lines.
 *
 * The terminal arranges that footer the same way: what the session is running
 * with sits on the right, and the labels extensions pinned with
 * `ctx.ui.setStatus` — `READONLY` among them — stand on their own on the left.
 * Every entry is keyed and carries its own placement, so nothing downstream has
 * to know what a particular entry means: the server decides what the footer
 * says, and the browser only lays it out.
 */
export const footerItemSchema = z.object({
  key: z.string().min(1),
  text: z.string().min(1),
  align: z.enum(["left", "right"]).default("left"),
  /** `badge` is for pinned state such as a mode marker; `plain` is quiet background detail. */
  variant: z.enum(["badge", "plain"]).default("plain"),
});

export type FooterItem = z.infer<typeof footerItemSchema>;

/**
 * A slash command Pi can dispatch. Typed UI actions stay the primary surface;
 * this catalogue is the generic fallback for everything else a session offers.
 */
export const slashCommandSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  argumentHint: z.string().optional(),
  source: z.enum(["native", "extension", "prompt", "skill"]).optional(),
});

export type SlashCommand = z.infer<typeof slashCommandSchema>;

export const commandCompletionItemSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
});
export type CommandCompletionItem = z.infer<typeof commandCompletionItemSchema>;

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
