export interface BashInput {
  command: string;
  excludeFromContext: boolean;
}

/** Only composer-leading markers are commands; the shell body is not parsed. */
export function parseBashInput(input: string): BashInput | undefined {
  const text = input.trim();
  if (!text.startsWith("!")) return undefined;
  const excludeFromContext = text.startsWith("!!");
  return { command: text.slice(excludeFromContext ? 2 : 1), excludeFromContext };
}
