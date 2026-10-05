export { localPathFromHref } from "../../../shared/files.js";

/** Quote a path for the existing server-side bash command. */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function openLocalLinkCommand(path: string): string {
  return `!!open -- ${shellQuote(path)}`;
}
