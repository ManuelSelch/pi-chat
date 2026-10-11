import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFileLogger } from "../../../../src/server/logging/file-logger.js";

let directory: string | undefined;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = undefined; });

async function tempDirectory(): Promise<string> {
  directory = await mkdtemp(join(tmpdir(), "pi-chat-logs-"));
  return directory;
}

describe("file logger", () => {
  it("writes structured records and retains a bounded set of rotated files", async () => {
    const logger = createFileLogger({ directory: await tempDirectory(), maxBytes: 256, retainedFiles: 2 });
    logger.info("server.started", { port: 8788 });
    logger.warn("websocket.closed", { code: 1000 });
    logger.info("websocket.open", { connectionId: "test" });
    logger.error("websocket.error", { message: "disconnected" });
    logger.info("websocket.open", { connectionId: "again-1" });
    logger.info("websocket.open", { connectionId: "again-2" });
    logger.info("websocket.open", { connectionId: "again-3" });
    await logger.flush();

    const files = await readdir(directory!);
    expect(files.sort()).toEqual(["pi-chat.log", "pi-chat.log.1", "pi-chat.log.2"]);
    const active = await readFile(join(directory!, "pi-chat.log"), "utf8");
    expect(JSON.parse(active)).toMatchObject({ level: "info", event: "websocket.open", fields: { connectionId: "again-3" } });
    for (const file of files) expect((await readFile(join(directory!, file))).byteLength).toBeLessThanOrEqual(256);
    await logger.close();
  });

  it("does not reject callers when the log directory is unavailable", async () => {
    const base = await tempDirectory();
    const blockedPath = join(base, "not-a-directory");
    await writeFile(blockedPath, "file");
    const onError = vi.fn();
    const logger = createFileLogger({ directory: blockedPath, maxBytes: 256, retainedFiles: 1, onError });
    logger.error("test.failure", { detail: "safe" });
    await expect(logger.flush()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledOnce();
    await logger.close();
  });
});
