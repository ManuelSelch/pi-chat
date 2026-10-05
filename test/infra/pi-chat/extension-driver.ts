import assert from "node:assert/strict";
import { PROTOCOL_VERSION, type UiPrompt, type UiPromptResult, type WidgetPlacement } from "../../../src/shared/protocol.js";
import { check, requireSession, type DriverContext } from "./driver-context.js";
import type { BrowserClient } from "./browser-client.js";

const promptBrand = Symbol("PiChatPrompt");
export interface PromptHandle { readonly [promptBrand]: true }
type NotificationLevel = "info" | "warning" | "error";

/** Extension operations observe only browser-projected state and server replies. */
export class ExtensionDriver {
  private readonly prompts = new WeakMap<PromptHandle, { sessionId: string; id: string }>();
  private readonly commandMarks = new Map<string, { client: BrowserClient; after: number }>();

  constructor(private readonly context: DriverContext) {}

  /** Dispatch a registered extension command and await its first visible output. */
  async RunCommand(name: string): Promise<void> {
    const { client } = this.context;
    const sessionId = requireSession(this.context, "Extensions.RunCommand");
    check(this.context, "Extensions.RunCommand", () => {
      assert(client.chat.actions.commands.some(command => command.name === name && command.source === "extension"), `Unknown extension command ${name}`);
      assert.equal(client.chat.status, "idle", "Conversation must be idle");
      assert.equal(client.chat.prompts.length, 0, "Answer the pending prompt before running another command");
    });
    const after = client.mark();
    this.commandMarks.set(sessionId, { client, after });
    client.send({ version: PROTOCOL_VERSION, type: "prompt", sessionId, message: `/${name}` });
    await client.waitForMessage("Extensions.RunCommand", "fresh extension UI output", after, message =>
      "sessionId" in message && message.sessionId === sessionId &&
      (message.type === "notification" || message.type === "widgets" ||
        (message.type === "prompts" && message.prompts.length > 0)));
  }

  async WaitForPrompt(title: string): Promise<PromptHandle> {
    const { client } = this.context;
    const sessionId = requireSession(this.context, "Extensions.WaitForPrompt");
    let prompt: UiPrompt | undefined;
    await client.wait("Extensions.WaitForPrompt", `prompt ${JSON.stringify(title)}`, () => {
      prompt = client.chat.prompts.find(item => item.title === title);
      return Boolean(prompt);
    });
    const handle = Object.freeze({ [promptBrand]: true as const });
    this.prompts.set(handle, { sessionId, id: prompt!.id });
    return handle;
  }

  async RespondToPrompt(handle: PromptHandle, result: UiPromptResult): Promise<void> {
    const { client } = this.context;
    const sessionId = requireSession(this.context, "Extensions.RespondToPrompt");
    const prompt = this.prompts.get(handle);
    check(this.context, "Extensions.RespondToPrompt", () => {
      assert(prompt, "Prompt belongs to another application or is not a valid handle");
      assert.equal(prompt.sessionId, sessionId, "Switch to the prompt's conversation before responding");
      assert(client.chat.prompts.some(item => item.id === prompt.id), "Prompt is no longer pending");
    });
    const after = client.mark();
    client.send({ version: PROTOCOL_VERSION, type: "uiPromptResponse", sessionId, promptId: prompt!.id, result });
    await client.waitForMessage("Extensions.RespondToPrompt", "answered prompt removed", after, message =>
      message.type === "prompts" && message.sessionId === sessionId && !message.prompts.some(item => item.id === prompt!.id));
  }

  async WaitForNotification(text: string, level: NotificationLevel = "info"): Promise<void> {
    const { client } = this.context;
    const sessionId = requireSession(this.context, "Extensions.WaitForNotification");
    const mark = this.commandMarks.get(sessionId);
    const after = mark?.client === client ? mark.after : 0;
    await client.waitForMessage("Extensions.WaitForNotification", `fresh notification ${JSON.stringify(text)}`, after, message =>
      message.type === "notification" && message.sessionId === sessionId && message.message === text && message.level === level);
  }

  ShouldShowPrompt(title: string, kind: UiPrompt["kind"], message?: string): void {
    check(this.context, "Extensions.ShouldShowPrompt", () => {
      const prompt = this.context.client.chat.prompts.find(item => item.title === title && item.kind === kind);
      assert(prompt, `Missing ${kind} prompt ${JSON.stringify(title)}`);
      if (message !== undefined) assert.equal(prompt.message, message);
    });
  }

  ShouldHaveNoPrompts(): void {
    check(this.context, "Extensions.ShouldHaveNoPrompts", () => assert.equal(this.context.client.chat.prompts.length, 0));
  }

  ShouldShowNotification(text: string, level: NotificationLevel = "info"): void {
    check(this.context, "Extensions.ShouldShowNotification", () =>
      assert(this.context.client.chat.messages.some(message => message.role === "notice" && message.text === text && message.level === level), `Missing notification ${JSON.stringify(text)}`));
  }

  ShouldShowWidget(key: string, lines: readonly string[], placement: WidgetPlacement = "aboveEditor"): void {
    check(this.context, "Extensions.ShouldShowWidget", () => {
      const widget = this.context.client.chat.widgets.find(item => item.key === key);
      assert(widget, `Missing widget ${key}`);
      assert.deepEqual(widget.lines, lines);
      assert.equal(widget.placement, placement);
    });
  }

  ShouldNotShowWidget(key: string): void {
    check(this.context, "Extensions.ShouldNotShowWidget", () => assert(!this.context.client.chat.widgets.some(item => item.key === key), `Unexpected widget ${key}`));
  }
}
