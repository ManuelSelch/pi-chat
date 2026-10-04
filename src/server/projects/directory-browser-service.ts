import { constants } from "node:fs";
import * as filesystem from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, parse, resolve, sep } from "node:path";
import { directoryBrowseSchema, type DirectoryBrowse, type DirectoryListing } from "../../shared/directories.js";

/** Read-only server filesystem navigation, independent of Pi session history. */
export class DirectoryBrowserService {
  constructor(
    private readonly home = homedir(),
    private readonly pageSize = 200,
    private readonly fs = filesystem,
  ) {}

  async validate(path: string, basePath?: string): Promise<string> {
    if (!path || path.includes("\0") || path.length > 4096) throw new Error("Invalid folder path.");
    const expanded = path === "~" ? this.home : /^~[/\\]/.test(path) ? join(this.home, path.slice(2)) : path;
    if (!isAbsolute(expanded) && (!basePath || !isAbsolute(basePath))) {
      throw new Error("Enter an absolute folder path, or a relative path with a base folder.");
    }
    try {
      const canonical = await this.fs.realpath(isAbsolute(expanded) ? expanded : resolve(basePath!, expanded));
      if (!(await this.fs.stat(canonical)).isDirectory()) throw new Error("The path is not a folder.");
      await this.fs.access(canonical, constants.R_OK | constants.X_OK);
      return canonical;
    } catch (error) {
      throw this.folderError(error);
    }
  }

  async browse(input: DirectoryBrowse): Promise<DirectoryListing> {
    const request = directoryBrowseSchema.parse(input);
    const path = await this.validate(request.path, request.basePath);
    try {
      const children = await this.fs.readdir(path, { withFileTypes: true });
      const entries: DirectoryListing["entries"] = [];
      // Sequential link checks keep filesystem concurrency bounded for large directories.
      for (const child of children) {
        if (!request.showHidden && child.name.startsWith(".")) continue;
        const childPath = join(path, child.name);
        if (child.isDirectory()) entries.push({ name: child.name, path: childPath });
        else if (child.isSymbolicLink()) {
          try {
            if ((await this.fs.stat(childPath)).isDirectory()) entries.push({ name: child.name, path: childPath });
          } catch { /* Broken/inaccessible links must not break the listing. */ }
        }
      }
      entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      const cursorIndex = request.cursor === undefined ? -1 : entries.findIndex((entry) => entry.name === request.cursor);
      if (request.cursor !== undefined && cursorIndex < 0) throw new Error("Folder listing changed. Refresh to continue.");
      const start = cursorIndex + 1;
      const page = entries.slice(start, start + this.pageSize);
      const parent = dirname(path);
      const root = parse(path).root;
      const breadcrumbs = [{ name: root, path: root }];
      let current = root;
      for (const name of path.slice(root.length).split(sep).filter(Boolean)) {
        current = join(current, name);
        breadcrumbs.push({ name, path: current });
      }
      return {
        path, parentPath: parent === path ? undefined : parent, breadcrumbs, entries: page,
        nextCursor: start + page.length < entries.length ? page.at(-1)?.name : undefined,
      };
    } catch (error) {
      throw this.folderError(error);
    }
  }

  private folderError(error: unknown): Error {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return new Error("Folder not found. It may have moved or been deleted.");
    if (code === "EACCES" || code === "EPERM") return new Error("Permission denied for this server folder.");
    if (code === "ENOTDIR") return new Error("The path is not a folder.");
    return error instanceof Error ? error : new Error("Unable to read this server folder.");
  }
}
