import type { ChatMessage } from "../shared/protocol.js";
import type { PiChatConnectionMode, PiChatConnectionRequest } from "./connection.js";

export type PiChatSlot = "session.header.right" | "composer.right" | "composer.below" | "session.status" | "settings.section";

export interface PiChatButton {
  id: string;
  slot: PiChatSlot;
  label: string;
  icon?: string;
  actionId: string;
}

export interface PiChatBadge {
  id: string;
  slot: PiChatSlot;
  label: string;
  tone?: "neutral" | "green" | "yellow" | "red";
}

export interface PiChatActionContext {
  connectionId?: string;
  sessionId: string;
  notify(message: string, level?: "info" | "warning" | "error"): void;
}

export interface PiChatAction {
  id: string;
  title: string;
  run(ctx: PiChatActionContext): Promise<void> | void;
}

export type PiChatHookEvent =
  | { name: "message.final"; payload: { sessionId: string; message: ChatMessage } }
  | { name: "session.snapshot"; payload: { sessionId: string } }
  | { name: "connection.open"; payload: { connectionId: string } }
  | { name: "connection.close"; payload: { connectionId: string } };

export type PiChatHookName = PiChatHookEvent["name"];
type HookPayload<Name extends PiChatHookName> = Extract<PiChatHookEvent, { name: Name }>["payload"];

type HookHandler<Name extends PiChatHookName> = (payload: HookPayload<Name>) => Promise<void> | void;

export type PiChatAuthorizationName =
  | "connection.authorize"
  | "prompt.authorize"
  | "action.authorize"
  | "abort.authorize"
  | "snapshot.authorize"
  /** Commands that change the shared set of open sessions, such as closing or deleting one. */
  | "session.authorize"
  /** Answering a blocking `ctx.ui` question, e.g. a permission gate for a tool call. */
  | "dialog.authorize";
export type PiChatAuthorizationResult = { allow: true } | { allow: false; reason: string };
export interface PiChatAuthorizationContext {
  connectionId: string;
  sessionId?: string;
  actionId?: string;
  /** Which session command is being attempted, for `session.authorize`. */
  operation?: PiChatSessionOperation;
  request?: PiChatConnectionRequest;
}

export type PiChatSessionOperation = "openProject" | "openSession" | "newSession" | "closeTab" | "deleteSession";
export type PiChatAuthorizationHandler = (ctx: PiChatAuthorizationContext) => Promise<PiChatAuthorizationResult | void> | PiChatAuthorizationResult | void;

export interface PiChatExtensionSnapshotContext {
  connectionId?: string;
  sessionId?: string;
}

/** Either a fixed value or one resolved per viewer, e.g. that viewer's own role. */
export type PiChatExtensionState =
  | Record<string, unknown>
  | unknown[]
  | ((ctx: PiChatExtensionSnapshotContext) => Record<string, unknown> | unknown[] | undefined);

/** A badge as sent to the browser: the tone default is resolved server side. */
export type ResolvedPiChatBadge = PiChatBadge & { tone: NonNullable<PiChatBadge["tone"]> };

export interface PiChatExtensionSnapshot {
  buttons: PiChatButton[];
  badges: ResolvedPiChatBadge[];
  state: Record<string, unknown>;
}

export interface PiChatExtensionRegistry {
  registerButton(button: PiChatButton): void;
  /** A badge may depend on the viewer, so it can be a function of the snapshot context. */
  registerBadge(badge: PiChatBadge | ((ctx: PiChatExtensionSnapshotContext) => PiChatBadge | undefined)): void;
  registerAction(action: PiChatAction): void;
  on<Name extends PiChatHookName>(name: Name, handler: HookHandler<Name>): void;
  use(name: PiChatAuthorizationName, handler: PiChatAuthorizationHandler): void;
  authorize(name: PiChatAuthorizationName, ctx: PiChatAuthorizationContext): Promise<PiChatAuthorizationResult>;
  setConnectionMode(mode: PiChatConnectionMode): void;
  connectionMode(): PiChatConnectionMode;
  setExtensionState(extensionId: string, state: PiChatExtensionState): void;
  clearExtensionState(extensionId: string): void;
  snapshot(ctx?: PiChatExtensionSnapshotContext): PiChatExtensionSnapshot;
  runAction(actionId: string, ctx: PiChatActionContext): Promise<void>;
  emit<Name extends PiChatHookName>(name: Name, payload: HookPayload<Name>): Promise<void>;
}

class InMemoryPiChatExtensionRegistry implements PiChatExtensionRegistry {
  private readonly buttons = new Map<string, PiChatButton>();
  private readonly badges: Array<PiChatBadge | ((ctx: PiChatExtensionSnapshotContext) => PiChatBadge | undefined)> = [];
  private readonly actions = new Map<string, PiChatAction>();
  private readonly hooks = new Map<PiChatHookName, Array<(payload: unknown) => Promise<void> | void>>();
  private readonly authorizers = new Map<PiChatAuthorizationName, PiChatAuthorizationHandler[]>();
  private readonly states = new Map<string, PiChatExtensionState>();
  private mode: PiChatConnectionMode = "single-controller";

  registerButton(button: PiChatButton): void {
    this.buttons.set(button.id, button);
  }

  registerBadge(badge: PiChatBadge | ((ctx: PiChatExtensionSnapshotContext) => PiChatBadge | undefined)): void {
    this.badges.push(badge);
  }

  registerAction(action: PiChatAction): void {
    this.actions.set(action.id, action);
  }

  on<Name extends PiChatHookName>(name: Name, handler: HookHandler<Name>): void {
    const handlers = this.hooks.get(name) ?? [];
    handlers.push(handler as (payload: unknown) => Promise<void> | void);
    this.hooks.set(name, handlers);
  }

  use(name: PiChatAuthorizationName, handler: PiChatAuthorizationHandler): void {
    const handlers = this.authorizers.get(name) ?? [];
    handlers.push(handler);
    this.authorizers.set(name, handlers);
  }

  async authorize(name: PiChatAuthorizationName, ctx: PiChatAuthorizationContext): Promise<PiChatAuthorizationResult> {
    for (const handler of this.authorizers.get(name) ?? []) {
      const result = await handler(ctx);
      if (result?.allow === false) return result;
    }
    return { allow: true };
  }

  setConnectionMode(mode: PiChatConnectionMode): void {
    this.mode = mode;
  }

  connectionMode(): PiChatConnectionMode {
    return this.mode;
  }

  setExtensionState(extensionId: string, state: PiChatExtensionState): void {
    this.states.set(extensionId, state);
  }

  clearExtensionState(extensionId: string): void {
    this.states.delete(extensionId);
  }

  snapshot(ctx: PiChatExtensionSnapshotContext = {}): PiChatExtensionSnapshot {
    return {
      buttons: [...this.buttons.values()],
      badges: this.badges
        .map((badge) => (typeof badge === "function" ? badge(ctx) : badge))
        .filter((badge): badge is PiChatBadge => badge !== undefined)
        .map((badge) => ({ ...badge, tone: badge.tone ?? "neutral" })),
      state: Object.fromEntries([...this.states.entries()].map(([id, state]) => [id, typeof state === "function" ? state(ctx) : state])),
    };
  }

  async runAction(actionId: string, ctx: PiChatActionContext): Promise<void> {
    const action = this.actions.get(actionId);
    if (!action) throw new Error(`Unknown Pi Chat extension action: ${actionId}`);
    await action.run(ctx);
  }

  async emit<Name extends PiChatHookName>(name: Name, payload: HookPayload<Name>): Promise<void> {
    for (const handler of this.hooks.get(name) ?? []) await handler(payload);
  }
}

const GLOBAL_KEY = Symbol.for("pi-chat.extension-registry");

export function createPiChatExtensionRegistry(): PiChatExtensionRegistry {
  return new InMemoryPiChatExtensionRegistry();
}

export function getPiChatExtensionRegistry(): PiChatExtensionRegistry {
  const root = globalThis as typeof globalThis & { [GLOBAL_KEY]?: PiChatExtensionRegistry };
  root[GLOBAL_KEY] ??= createPiChatExtensionRegistry();
  return root[GLOBAL_KEY];
}

export function resetPiChatExtensionRegistryForTests(): void {
  delete (globalThis as typeof globalThis & { [GLOBAL_KEY]?: PiChatExtensionRegistry })[GLOBAL_KEY];
}
