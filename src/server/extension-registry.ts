import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { ChatMessage } from "../shared/protocol.js";

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
  sessionId: string;
  notify(message: string, level?: "info" | "warning" | "error"): void;
  /**
   * The dialog surface of the session this action was invoked from, so a button
   * can ask a question without holding on to a `ctx.ui` from elsewhere. Each
   * session has its own, and a held one outlives the session it belongs to.
   *
   * Absent when there is no session to open a modal in, which is the home
   * screen: app-level actions such as a restart run from there.
   */
  ui?: ExtensionUIContext;
}

export interface PiChatAction {
  id: string;
  title: string;
  run(ctx: PiChatActionContext): Promise<void> | void;
}

export type PiChatHookEvent =
  | { name: "message.final"; payload: { sessionId: string; message: ChatMessage } }
  | { name: "session.snapshot"; payload: { sessionId: string } };

export type PiChatHookName = PiChatHookEvent["name"];
type HookPayload<Name extends PiChatHookName> = Extract<PiChatHookEvent, { name: Name }>["payload"];

type HookHandler<Name extends PiChatHookName> = (payload: HookPayload<Name>) => Promise<void> | void;

export interface PiChatExtensionSnapshotContext {
  sessionId?: string;
}

/** A badge as sent to the browser: the tone default is resolved server side. */
export type ResolvedPiChatBadge = PiChatBadge & { tone: NonNullable<PiChatBadge["tone"]> };

export interface PiChatExtensionSnapshot {
  buttons: PiChatButton[];
  badges: ResolvedPiChatBadge[];
  state: Record<string, unknown>;
}

/**
 * Which extension a registration belongs to.
 *
 * Pi loads extensions once per open session, so a second session runs the same
 * extension factory again against this one global registry. Keyed registrations
 * such as buttons survive that by being overwritten; lists did not, and stale
 * hook handlers from earlier loads duplicated side effects. An owner makes a
 * re-registration replace its predecessor instead of stacking on top of it.
 */
export interface PiChatRegistrationOptions {
  owner?: string;
}

export interface PiChatExtensionRegistry {
  registerButton(button: PiChatButton): void;
  /** Removes a button again, e.g. when an extension is switched off at runtime. */
  unregisterButton(buttonId: string): void;
  registerBadge(badge: PiChatBadge, options?: PiChatRegistrationOptions): void;
  registerAction(action: PiChatAction): void;
  on<Name extends PiChatHookName>(name: Name, handler: HookHandler<Name>, options?: PiChatRegistrationOptions): void;
  /**
   * State that belongs to the extension rather than to one session. The same
   * object comes back for a given id, so an extension re-loaded by a second
   * session keeps its local state.
   */
  store<T extends object>(extensionId: string, initial: () => T): T;
  setExtensionState(extensionId: string, state: Record<string, unknown> | unknown[]): void;
  clearExtensionState(extensionId: string): void;
  snapshot(ctx?: PiChatExtensionSnapshotContext): PiChatExtensionSnapshot;
  runAction(actionId: string, ctx: PiChatActionContext): Promise<void>;
  emit<Name extends PiChatHookName>(name: Name, payload: HookPayload<Name>): Promise<void>;
}

class InMemoryPiChatExtensionRegistry implements PiChatExtensionRegistry {
  private readonly buttons = new Map<string, PiChatButton>();
  /** Keyed like the others so a re-registration replaces rather than duplicates. */
  private readonly badges = new Map<string, PiChatBadge>();
  private readonly actions = new Map<string, PiChatAction>();
  private readonly hooks = new Map<PiChatHookName, Map<string, (payload: unknown) => Promise<void> | void>>();
  private readonly states = new Map<string, Record<string, unknown> | unknown[]>();
  private readonly stores = new Map<string, object>();
  /** Distinguishes registrations that named no owner, which stay additive. */
  private anonymous = 0;

  private keyFor(options?: PiChatRegistrationOptions): string {
    return options?.owner ? `owner:${options.owner}` : `anonymous:${++this.anonymous}`;
  }

  registerButton(button: PiChatButton): void {
    this.buttons.set(button.id, button);
  }

  unregisterButton(buttonId: string): void {
    this.buttons.delete(buttonId);
  }

  registerBadge(badge: PiChatBadge, options?: PiChatRegistrationOptions): void {
    this.badges.set(options?.owner ? `owner:${options.owner}` : `id:${badge.id}`, badge);
  }

  registerAction(action: PiChatAction): void {
    this.actions.set(action.id, action);
  }

  on<Name extends PiChatHookName>(name: Name, handler: HookHandler<Name>, options?: PiChatRegistrationOptions): void {
    const handlers = this.hooks.get(name) ?? new Map();
    handlers.set(this.keyFor(options), handler as (payload: unknown) => Promise<void> | void);
    this.hooks.set(name, handlers);
  }

  store<T extends object>(extensionId: string, initial: () => T): T {
    const existing = this.stores.get(extensionId);
    if (existing) return existing as T;
    const created = initial();
    this.stores.set(extensionId, created);
    return created;
  }

  setExtensionState(extensionId: string, state: Record<string, unknown> | unknown[]): void {
    this.states.set(extensionId, state);
  }

  clearExtensionState(extensionId: string): void {
    this.states.delete(extensionId);
  }

  snapshot(_ctx: PiChatExtensionSnapshotContext = {}): PiChatExtensionSnapshot {
    return {
      buttons: [...this.buttons.values()],
      badges: [...this.badges.values()].map((badge) => ({ ...badge, tone: badge.tone ?? "neutral" })),
      state: Object.fromEntries(this.states.entries()),
    };
  }

  async runAction(actionId: string, ctx: PiChatActionContext): Promise<void> {
    const action = this.actions.get(actionId);
    if (!action) throw new Error(`Unknown Pi Chat extension action: ${actionId}`);
    await action.run(ctx);
  }

  async emit<Name extends PiChatHookName>(name: Name, payload: HookPayload<Name>): Promise<void> {
    for (const handler of this.hooks.get(name)?.values() ?? []) await handler(payload);
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
