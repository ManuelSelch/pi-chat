import type { SlashCommand } from "../../../shared/protocol.js";

export interface ArgumentContext {
  commandName: string;
  argumentPrefix: string;
  start: number;
  end: number;
}

/** Pi completes the entire argument prefix, not an individual shell token. */
export function argumentContext(input: string, start: number, end: number, commands: readonly SlashCommand[]): ArgumentContext | undefined {
  if (!input.startsWith("/") || start !== end) return undefined;
  const beforeCaret = input.slice(0, start);
  if (beforeCaret.includes("\n")) return undefined;
  const separator = beforeCaret.indexOf(" ");
  if (separator < 2) return undefined;
  const commandName = beforeCaret.slice(1, separator);
  if (!commands.some((command) => command.name === commandName && command.source === "extension")) return undefined;
  return { commandName, argumentPrefix: beforeCaret.slice(separator + 1), start: separator + 1, end: start };
}

export function applyArgumentCompletion(input: string, context: ArgumentContext, value: string): { input: string; caret: number } {
  return { input: input.slice(0, context.start) + value + input.slice(context.end), caret: context.start + value.length };
}
