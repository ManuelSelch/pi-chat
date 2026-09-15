import type { ChatMessage } from "../shared/protocol.js";

export type PiChatSlot = "session.header.right" | "composer.right" | "settings.section";

export interface PiChatButton {
  id: string;
  slot: PiChatSlot;
  label: string;
  icon?: string;
  actionId: string;
}

export interface PiChatActionContext {
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

export interface PiChatExtensionSnapshot {
  buttons: PiChatButton[];
}

export interface PiChatExtensionRegistry {
  registerButton(button: PiChatButton): void;
  registerAction(action: PiChatAction): void;
  on<Name extends PiChatHookName>(name: Name, handler: HookHandler<Name>): void;
  snapshot(): PiChatExtensionSnapshot;
  runAction(actionId: string, ctx: PiChatActionContext): Promise<void>;
  emit<Name extends PiChatHookName>(name: Name, payload: HookPayload<Name>): Promise<void>;
}

class InMemoryPiChatExtensionRegistry implements PiChatExtensionRegistry {
  private readonly buttons = new Map<string, PiChatButton>();
  private readonly actions = new Map<string, PiChatAction>();
  private readonly hooks = new Map<PiChatHookName, Array<(payload: unknown) => Promise<void> | void>>();

  registerButton(button: PiChatButton): void {
    this.buttons.set(button.id, button);
  }

  registerAction(action: PiChatAction): void {
    this.actions.set(action.id, action);
  }

  on<Name extends PiChatHookName>(name: Name, handler: HookHandler<Name>): void {
    const handlers = this.hooks.get(name) ?? [];
    handlers.push(handler as (payload: unknown) => Promise<void> | void);
    this.hooks.set(name, handlers);
  }

  snapshot(): PiChatExtensionSnapshot {
    return { buttons: [...this.buttons.values()] };
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
