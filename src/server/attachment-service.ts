import { readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

export interface ImageAttachment {
  type: "image";
  data: string;
  mimeType: string;
}

export interface ResolvedAttachments {
  /** Images Pi can send as real image content. */
  images: ImageAttachment[];
  /** Canonical paths for everything the model can only be pointed at. */
  references: string[];
}

/**
 * Images are inlined, so a runaway file would be base64-encoded into the
 * request. Anything larger stays a path reference instead.
 */
const MAX_INLINE_IMAGE_BYTES = 8 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
]);

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return resolve(homedir(), path.slice(2));
  return path;
}

function imageMimeType(path: string): string | undefined {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return undefined;
  return IMAGE_MIME_TYPES.get(path.slice(dot).toLowerCase());
}

/**
 * Attachments are local path references, never uploads: the browser sends a
 * path and the server decides what that path really is. Validation happens here
 * so a typo fails with a clear message instead of reaching the model as text.
 */
export class AttachmentService {
  async resolve(paths: readonly string[], cwd: string): Promise<ResolvedAttachments> {
    const images: ImageAttachment[] = [];
    const references: string[] = [];

    for (const raw of paths) {
      const canonical = await this.canonicalPath(raw, cwd);
      const mimeType = imageMimeType(canonical);
      if (!mimeType) {
        references.push(canonical);
        continue;
      }
      const info = await stat(canonical);
      if (info.size > MAX_INLINE_IMAGE_BYTES) {
        // Still useful to the model as a path; tools can read it on demand.
        references.push(canonical);
        continue;
      }
      const data = await readFile(canonical);
      images.push({ type: "image", data: data.toString("base64"), mimeType });
    }

    return { images, references };
  }

  private async canonicalPath(raw: string, cwd: string): Promise<string> {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error("Attachment path is empty.");
    const expanded = expandHome(stripFileUrl(trimmed));
    const absolute = isAbsolute(expanded) ? expanded : resolve(cwd, expanded);

    let canonical: string;
    try {
      canonical = await realpath(absolute);
    } catch {
      throw new Error(`Attachment not found: ${trimmed}`);
    }

    const info = await stat(canonical);
    if (info.isDirectory()) throw new Error(`Attachment is a folder, not a file: ${trimmed}`);
    if (!info.isFile()) throw new Error(`Attachment is not a regular file: ${trimmed}`);
    return canonical;
  }
}

/** Finder and most file managers hand over `file://` URLs rather than paths. */
export function stripFileUrl(value: string): string {
  if (!value.startsWith("file://")) return value;
  try {
    return decodeURIComponent(new URL(value).pathname);
  } catch {
    return value;
  }
}

/**
 * Non-image attachments reach the model as an explicit, canonical path block so
 * it can decide to read them with its own tools.
 */
export function withReferences(message: string, references: readonly string[]): string {
  if (references.length === 0) return message;
  const lines = references.map((path) => `- ${path}`).join("\n");
  return `${message}\n\nAttached files (local paths):\n${lines}`;
}
