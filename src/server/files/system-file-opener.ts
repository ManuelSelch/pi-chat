import { execFile } from "node:child_process";
import { isAbsolute } from "node:path";
import { filePathSchema } from "../../shared/files.js";
import { FileOpenError } from "./file-open-error.js";

export interface FileOpener {
  open(path: string): Promise<void>;
}

/** Opens on the server machine. No runtime, shell fallback, or retries. */
export class SystemFileOpener implements FileOpener {
  constructor(private readonly platform: NodeJS.Platform = process.platform) {}

  async open(path: string): Promise<void> {
    if (!isAbsolute(path) || !filePathSchema.safeParse(path).success) {
      throw new FileOpenError("invalidPath", "Invalid file path on the server.");
    }
    if (this.platform !== "darwin") {
      throw new FileOpenError("unsupported", "Opening files on the server is currently supported only on macOS.");
    }
    try {
      await new Promise<void>((resolve, reject) => {
        execFile("/usr/bin/open", ["--", path], {
          shell: false, timeout: 5000, killSignal: "SIGKILL", maxBuffer: 8192,
        }, (error) => error ? reject(error) : resolve());
      });
    } catch {
      throw new FileOpenError("openFailed", "Unable to open this file on the server.");
    }
  }
}
