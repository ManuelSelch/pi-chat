import { randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";

export async function publishPidFile(path: string, record: { pid: number; port: number; cwd: string }): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(record));
    // Same-directory rename exposes only complete records to restart observers.
    await rename(temporary, path);
  } catch (error) {
    // Preserve the publication error if cleanup also fails.
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}
