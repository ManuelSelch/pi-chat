export { filePathSchema, fileOpenErrorCodeSchema, fileOpenResultSchema } from "@manuelselch/pi-sdk/contract";
export type { FileOpenErrorCode, FileOpenResult } from "@manuelselch/pi-sdk/contract";
import { filePathSchema } from "@manuelselch/pi-sdk/contract";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** Decode a Markdown destination once; wire paths are already extracted. */
export function localPathFromHref(href: string): string | undefined {
  if (CONTROL_CHARACTERS.test(href) || /^[\\/]{2}/.test(href)) return undefined;
  let encodedPath: string;
  if (/^file:/i.test(href)) {
    if (href.includes("\\")) return undefined;
    try {
      const url = new URL(href);
      if ((url.hostname && url.hostname !== "localhost") || url.username || url.password || url.port) return undefined;
      encodedPath = url.pathname;
    } catch { return undefined; }
  } else {
    if (URL_SCHEME.test(href)) return undefined;
    encodedPath = href.split(/[?#]/, 1)[0]!;
  }
  try {
    const path = decodeURIComponent(encodedPath);
    return filePathSchema.safeParse(path).success ? path : undefined;
  } catch { return undefined; }
}
