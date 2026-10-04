/** Terminal colour/control sequences must not reach browser-rendered text. */
const ANSI = new RegExp("\\u001B\\[[0-9;?]*[ -/]*[@-~]", "g");

export function stripAnsi(line: string): string {
  return line.replace(ANSI, "");
}
