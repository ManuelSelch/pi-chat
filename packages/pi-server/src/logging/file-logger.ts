import { appendFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface FileLoggerOptions {
  directory?: string;
  maxBytes?: number;
  retainedFiles?: number;
  onError?: (error: unknown) => void;
}

export interface FileLogger {
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}

export const DEFAULT_LOG_MAX_BYTES = 5 * 1024 * 1024;
export const DEFAULT_LOG_RETAINED_FILES = 3;

export function createFileLogger(options: FileLoggerOptions = {}): FileLogger {
  const directory = options.directory ?? process.env.PI_CHAT_LOG_DIR ?? join(homedir(), ".pi", "agent", "logs");
  const maxBytes = Math.max(256, options.maxBytes ?? (Number(process.env.PI_CHAT_LOG_MAX_BYTES) || DEFAULT_LOG_MAX_BYTES));
  const retainedFiles = Math.max(0, options.retainedFiles ?? (Number(process.env.PI_CHAT_LOG_RETAINED_FILES) || DEFAULT_LOG_RETAINED_FILES));
  const filePath = join(directory, "pi-chat.log");
  const reportError = options.onError ?? ((error: unknown) => console.error("[pi-chat] logfile error", error));
  let queue = Promise.resolve();
  let closed = false;

  function emit(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}): void {
    if (closed) return;
    const timestamp = new Date().toISOString();
    let record = `${JSON.stringify({ timestamp, level, event, fields })}\n`;
    if (Buffer.byteLength(record) > maxBytes) {
      record = `${JSON.stringify({ timestamp, level, event, fields: { truncated: true } })}\n`;
    }
    queue = queue.then(async () => {
      await mkdir(directory, { recursive: true });
      let size = 0;
      try { size = (await stat(filePath)).size; } catch { /* New file. */ }
      if (size > 0 && size + Buffer.byteLength(record) > maxBytes) await rotate();
      await appendFile(filePath, record, { encoding: "utf8", flag: "a" });
    }).catch((error: unknown) => { reportError(error); });
  }

  async function rotate(): Promise<void> {
    if (retainedFiles === 0) {
      await unlink(filePath).catch(() => undefined);
      return;
    }
    await unlink(`${filePath}.${retainedFiles}`).catch(() => undefined);
    for (let index = retainedFiles - 1; index >= 1; index--) {
      await rename(`${filePath}.${index}`, `${filePath}.${index + 1}`).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
    await rename(filePath, `${filePath}.1`);
  }

  return {
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
    flush: () => queue,
    async close() { await queue; closed = true; },
  };
}
