import type { SlashCommand } from "../../shared/protocol.js";

/**
 * The menu only applies to a slash typed at the very start of the composer, so
 * a path like `cd /usr` or a mid-sentence slash never hijacks typing.
 */
export function commandQuery(input: string): string | undefined {
  if (!input.startsWith("/")) return undefined;
  const query = input.slice(1);
  // Once the command name is complete the user is writing arguments.
  if (/\s/.test(query)) return undefined;
  return query;
}

export function filterCommands(commands: readonly SlashCommand[], query: string): SlashCommand[] {
  if (!query) return [...commands];
  const needle = query.toLowerCase();
  const matches = commands.filter((command) => command.name.toLowerCase().includes(needle));
  // Prefix matches are what the user is usually typing towards.
  return matches.sort((left, right) => {
    const leftPrefix = left.name.toLowerCase().startsWith(needle) ? 0 : 1;
    const rightPrefix = right.name.toLowerCase().startsWith(needle) ? 0 : 1;
    return leftPrefix === rightPrefix ? left.name.localeCompare(right.name) : leftPrefix - rightPrefix;
  });
}
