import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { z } from "zod";

const archiveSchema = z.object({
  path: z.string().min(1), id: z.string().min(1), cwd: z.string().min(1),
  archivedAt: z.number().finite().nonnegative(),
  repositoryPath: z.string().optional(), repositoryName: z.string().optional(), branch: z.string().optional(),
});
const metadataSchema = z.object({ version: z.literal(1), pins: z.array(z.string().min(1)), archives: z.array(archiveSchema) });
export type ProjectMetadata = z.infer<typeof metadataSchema>;
export type ArchiveDescriptor = Omit<ProjectMetadata["archives"][number], "archivedAt">;

/** Pi Chat metadata only: never changes the original Pi session files.
 * One writer per agent directory. Writes within this process are serialized.
 */
export class ProjectMetadataStore {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(readonly path = resolve(getAgentDir(), "pi-chat", "projects.json")) {}

  async read(): Promise<ProjectMetadata> {
    await this.pending.catch(() => undefined);
    return this.load();
  }

  pin(path: string, pinned: boolean): Promise<void> {
    return this.update(data => {
      data.pins = data.pins.filter(pin => pin !== path);
      if (pinned) data.pins.push(path);
    });
  }

  archive(session: ArchiveDescriptor, archived: boolean): Promise<void> {
    return this.update(data => {
      const previous = data.archives.find(a => a.path === session.path && a.id === session.id);
      data.archives = data.archives.filter(a => a.path !== session.path);
      if (archived) data.archives.push({ ...session, archivedAt: previous?.archivedAt ?? Date.now() });
    });
  }

  private async load(): Promise<ProjectMetadata> {
    let content: string;
    try { content = await readFile(this.path, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, pins: [], archives: [] };
      throw new Error("Unable to read Pi Chat project metadata.", { cause: error });
    }
    try { return metadataSchema.parse(JSON.parse(content)); }
    catch (error) { throw new Error("Pi Chat project metadata is malformed or unsupported. Repair it before changing pins or archives.", { cause: error }); }
  }

  private update(change: (data: ProjectMetadata) => void): Promise<void> {
    const task = this.pending.catch(() => undefined).then(async () => {
      const data = await this.load();
      change(data);
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${crypto.randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(data, null, 2) + "\n", { mode: 0o600, flag: "wx" });
        await rename(temporary, this.path);
      } finally { await rm(temporary, { force: true }); }
    });
    this.pending = task;
    return task;
  }
}
