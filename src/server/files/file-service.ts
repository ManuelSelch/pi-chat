import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { filePathSchema, type FileOpenResult } from "../../shared/files.js";
import { FileOpenError, fileOpenFailure } from "./file-open-error.js";
import { SystemFileOpener, type FileOpener } from "./system-file-opener.js";

/** Canonicalization is validation, not a workspace sandbox or security scan. */
export class FileService {
  constructor(private readonly opener: FileOpener = new SystemFileOpener()) {}

  async open(projectPath: string, path: string): Promise<FileOpenResult> {
    if (!filePathSchema.safeParse(path).success) {
      return fileOpenFailure("invalidPath", "Invalid file path on the server.");
    }
    if (!filePathSchema.safeParse(projectPath).success || !isAbsolute(projectPath)) {
      return fileOpenFailure("sessionUnavailable", "This session's server project directory is unavailable.");
    }
    try {
      const target = await realpath(resolve(projectPath, path));
      if (!filePathSchema.safeParse(target).success) {
        return fileOpenFailure("invalidPath", "Invalid canonical file path on the server.");
      }
      if (!(await stat(target)).isFile()) {
        return fileOpenFailure("notFile", "The target on the server is not a regular file.");
      }
      await access(target, constants.R_OK);
      // Files can disappear/change after validation. Opening is not transactional.
      await this.opener.open(target);
      return { ok: true };
    } catch (error) {
      if (error instanceof FileOpenError) return fileOpenFailure(error.code, error.message);
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT" || code === "ENOTDIR") return fileOpenFailure("notFound", "File not found on the server.");
      if (code === "EACCES" || code === "EPERM") return fileOpenFailure("permissionDenied", "The server does not have permission to read this file.");
      return fileOpenFailure("openFailed", "Unable to open this file on the server.");
    }
  }
}
