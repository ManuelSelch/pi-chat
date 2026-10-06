import type { SlashCommand } from "../../../shared/protocol.js";

export interface ArgumentContext {
  commandName: string;
  argumentPrefix: string;
  start: number;
  end: number;
}

/**
 * Pi's callback receives and replaces the entire argument prefix, not just
 * the current token. Keep the replacement range identical to that prefix.
 */
export function argumentContext(input: string, start: number, end: number, commands: readonly SlashCommand[]): ArgumentContext | undefined {
  if (!input.startsWith("/") || start !== end) return undefined;
  const beforeCaret = input.slice(0, start);
  if (beforeCaret.includes("\n")) return undefined;
  const separator = beforeCaret.indexOf(" ");
  if (separator < 2) return undefined;
  const commandName = beforeCaret.slice(1, separator);
  if (!commands.some((command) => command.name === commandName && command.source === "extension")) return undefined;

  const argumentStart = separator + 1;
  return { commandName, argumentPrefix: beforeCaret.slice(argumentStart), start: argumentStart, end: start };
}

export function applyArgumentCompletion(input: string, context: ArgumentContext, value: string): { input: string; caret: number } {
  return { input: input.slice(0, context.start) + value + input.slice(context.end), caret: context.start + value.length };
}
