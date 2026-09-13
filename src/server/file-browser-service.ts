import { readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { DirectoryEntry, DirectoryListing } from "../shared/protocol.js";

/**
 * The browser cannot see the filesystem and a file input never exposes a real
 * path, so picking a local attachment has to be answered by the server.
 */
export class FileBrowserService {
  async list(path: string | undefined, fallback: string): Promise<DirectoryListing> {
    const target = await realpath(resolve(path?.trim() || fallback || homedir()));
    const info = await stat(target);
    const directory = info.isDirectory() ? target : dirname(target);

    const found = await readdir(directory, { withFileTypes: true });
    const entries: DirectoryEntry[] = [];
    for (const entry of found) {
      // Dotfiles are noise for picking documents, and unreadable links would
      // only fail later during attachment resolution.
      if (entry.name.startsWith(".")) continue;
      const isDirectory = entry.isDirectory() || (entry.isSymbolicLink() && (await this.isDirectory(join(directory, entry.name))));
      if (!isDirectory && !entry.isFile() && !entry.isSymbolicLink()) continue;
      entries.push({ name: entry.name, path: join(directory, entry.name), isDirectory });
    }

    entries.sort((left, right) =>
      left.isDirectory === right.isDirectory ? left.name.localeCompare(right.name) : left.isDirectory ? -1 : 1,
    );

    const parent = dirname(directory);
    return { path: directory, parent: parent === directory ? undefined : parent, entries };
  }

  private async isDirectory(path: string): Promise<boolean> {
    try {
      return (await stat(path)).isDirectory();
    } catch {
      return false;
    }
  }
}
