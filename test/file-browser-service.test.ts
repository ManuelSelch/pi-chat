import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { FileBrowserService } from "../src/server/file-browser-service.js";

const service = new FileBrowserService();
let root = "";

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "pi-chat-browser-"));
  await mkdir(join(root, "documents"));
  await writeFile(join(root, "notes.pdf"), "pdf");
  await writeFile(join(root, ".hidden"), "secret");
});

describe("FileBrowserService", () => {
  it("lists folders before files and hides dotfiles", async () => {
    const listing = await service.list(root, root);

    expect(listing.entries.map((entry) => entry.name)).toEqual(["documents", "notes.pdf"]);
    expect(listing.entries[0]!.isDirectory).toBe(true);
  });

  it("lists the containing folder when given a file", async () => {
    const listing = await service.list(join(root, "notes.pdf"), root);

    expect(listing.entries.some((entry) => entry.name === "notes.pdf")).toBe(true);
  });

  it("falls back to the project folder when no path is given", async () => {
    const listing = await service.list(undefined, root);

    expect(listing.path).toContain("pi-chat-browser-");
    expect(listing.parent).toBeDefined();
  });
});
