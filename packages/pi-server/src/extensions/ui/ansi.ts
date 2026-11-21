/** CSI normalization shared by plain-text surfaces and styled widgets. OSC handling is separate. */
const ANSI = new RegExp("\\u001B\\[[0-9;?]*[ -/]*[@-~]", "g");

export function stripAnsi(line: string): string {
  return line.replace(ANSI, "");
}

/** Widgets retain SGR styling, but never cursor movement or erase operations. */
export function preserveSgr(line: string): string {
  return line.replace(ANSI, (sequence) => /^\u001b\[[0-9;]*m$/.test(sequence) ? sequence : "");
}
