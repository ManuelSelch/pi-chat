import type { SlashCommand } from "../../shared/protocol.js";

/**
 * A menu row is either a Pi slash command (inserted into the composer) or an
 * action this UI performs itself, such as renaming the session. Both are shown
 * in one list so Cmd+K answers "what can I do right now?".
 */
export interface LocalAction {
  name: string;
  description: string;
  run: () => void;
}

export type MenuItem = (SlashCommand & { kind: "command" }) | (LocalAction & { kind: "action" });

/** Session actions rank first: they are the reason Cmd+K was pressed. */
export function menuItems(actions: readonly LocalAction[], commands: readonly SlashCommand[]): MenuItem[] {
  return [
    ...actions.map((action) => ({ ...action, kind: "action" as const })),
    ...commands.map((command) => ({ ...command, kind: "command" as const })),
  ];
}

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

export function filterCommands<T extends { name: string }>(commands: readonly T[], query: string): T[] {
  if (!query) return [...commands];
  const needle = query.toLowerCase();
  const matches = commands.filter((command) => command.name.toLowerCase().includes(needle));
  // Prefix matches are what the user is usually typing towards. Ties keep the
  // incoming order, which is session actions first and commands alphabetical;
  // Array#sort is stable, so no explicit name comparison is needed.
  return matches.sort((left, right) => {
    const leftPrefix = left.name.toLowerCase().startsWith(needle) ? 0 : 1;
    const rightPrefix = right.name.toLowerCase().startsWith(needle) ? 0 : 1;
    return leftPrefix - rightPrefix;
  });
}
