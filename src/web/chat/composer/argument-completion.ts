import type { SlashCommand } from "../../../shared/protocol.js";

export interface ArgumentContext {
  commandName: string;
  argumentPrefix: string;
  start: number;
  end: number;
}

/**
 * Find the argument currently being edited while keeping the complete prefix
 * for Pi's context-aware completion callback.
 */
export function argumentContext(input: string, start: number, end: number, commands: readonly SlashCommand[]): ArgumentContext | undefined {
  if (!input.startsWith("/") || start !== end) return undefined;
  const beforeCaret = input.slice(0, start);
  if (beforeCaret.includes("\n")) return undefined;
  const separator = beforeCaret.indexOf(" ");
  if (separator < 2) return undefined;
  const commandName = beforeCaret.slice(1, separator);
  if (!commands.some((command) => command.name === commandName && command.source === "extension")) return undefined;

  let argumentStart = separator + 1;
  let replacementStart = argumentStart;
  let quote: string | undefined;
  let escaped = false;
  for (let index = argumentStart; index < start; index += 1) {
    const character = input[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      if (index === argumentStart || replacementStart === argumentStart) replacementStart = index + 1;
      continue;
    }
    if (/\s/.test(character)) {
      argumentStart = index + 1;
      replacementStart = argumentStart;
    }
  }

  return { commandName, argumentPrefix: beforeCaret.slice(separator + 1), start: replacementStart, end: start };
}

export function applyArgumentCompletion(input: string, context: ArgumentContext, value: string): { input: string; caret: number } {
  return { input: input.slice(0, context.start) + value + input.slice(context.end), caret: context.start + value.length };
}
