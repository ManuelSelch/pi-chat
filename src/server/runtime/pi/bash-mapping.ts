import type { BashCard } from "../../../shared/protocol.js";
import { stripAnsi } from "../../extensions/ui/ansi.js";

export const BASH_OUTPUT_MAX = 20_000;

/** Bound the completed result before sending it to the browser. Pi owns the full output file. */
export function bashOutput(text: string): { output: string; truncated: boolean } {
  const plain = stripAnsi(text);
  return { output: plain.slice(-BASH_OUTPUT_MAX), truncated: plain.length > BASH_OUTPUT_MAX };
}

export function bashCardFromMessage(value: Record<string, unknown>): BashCard {
  const output = bashOutput(typeof value.output === "string" ? value.output : "");
  const exitCode = typeof value.exitCode === "number" ? value.exitCode : undefined;
  return {
    command: stripAnsi(typeof value.command === "string" ? value.command : ""),
    ...output,
    truncated: output.truncated || value.truncated === true,
    status: value.cancelled === true ? "cancelled" : exitCode === 0 ? "success" : "error",
    ...(exitCode === undefined ? {} : { exitCode }),
    excludeFromContext: value.excludeFromContext === true,
    ...(typeof value.fullOutputPath === "string" ? { fullOutputPath: stripAnsi(value.fullOutputPath) } : {}),
  };
}
