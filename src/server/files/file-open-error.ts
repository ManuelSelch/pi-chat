import type { FileOpenErrorCode, FileOpenResult } from "../../shared/files.js";

export class FileOpenError extends Error {
  constructor(public readonly code: FileOpenErrorCode, message: string) {
    super(message);
  }
}

export function fileOpenFailure(code: FileOpenErrorCode, message: string): FileOpenResult {
  return { ok: false, error: { code, message: message.slice(0, 512) } };
}
