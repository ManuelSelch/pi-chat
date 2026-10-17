// Wire validation lives in the SDK; Markdown-link interpretation remains app-owned.
export { filePathSchema, fileRequestIdSchema, fileOpenRequestSchema, fileOpenErrorCodeSchema, fileOpenResultSchema } from "@manuelselch/pi-sdk/contract";
export type { FileOpenRequest, FileOpenErrorCode, FileOpenResult } from "@manuelselch/pi-sdk/contract";
import { filePathSchema } from "@manuelselch/pi-sdk/contract";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/**
 * Extract a server-local path from a Markdown URI destination. Decode once,
 * stripping query/fragment metadata first; literal #/?/% must be URI-escaped.
 * Wire paths are already extracted and must not be decoded again.
 */
export function localPathFromHref(href: string): string | undefined {
  // URL would silently discard tabs/newlines and normalize backslashes.
  if (CONTROL_CHARACTERS.test(href) || /^[\\/]{2}/.test(href)) return undefined;
  let encodedPath: string;
  if (/^file:/i.test(href)) {
    if (href.includes("\\")) return undefined;
    try {
      const url = new URL(href);
      if ((url.hostname && url.hostname !== "localhost") || url.username || url.password || url.port) return undefined;
      encodedPath = url.pathname;
    } catch {
      return undefined;
    }
  } else {
    if (URL_SCHEME.test(href)) return undefined;
    encodedPath = href.split(/[?#]/, 1)[0]!;
  }
  try {
    const path = decodeURIComponent(encodedPath);
    return filePathSchema.safeParse(path).success ? path : undefined;
  } catch {
    return undefined;
  }
}
