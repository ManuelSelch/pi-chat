import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { AttachmentService, stripFileUrl, withReferences } from "../src/server/attachment-service.js";

const service = new AttachmentService();
let cwd = "";
let pdfPath = "";
let pngPath = "";

/** 1x1 transparent PNG, small enough to stay an inline image. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

beforeAll(async () => {
  cwd = await mkdtemp(join(tmpdir(), "pi-chat-attachments-"));
  pdfPath = join(cwd, "notes.pdf");
  pngPath = join(cwd, "diagram.png");
  await writeFile(pdfPath, "%PDF-1.4 fake");
  await writeFile(pngPath, Buffer.from(PNG_BASE64, "base64"));
});

describe("AttachmentService", () => {
  it("sends a supported image as Pi image content", async () => {
    const { images, references } = await service.resolve([pngPath], cwd);

    expect(references).toEqual([]);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ type: "image", mimeType: "image/png" });
    expect(images[0]!.data).toBe(PNG_BASE64);
  });

  it("keeps a PDF as its validated canonical path", async () => {
    const { images, references } = await service.resolve(["notes.pdf"], cwd);

    expect(images).toEqual([]);
    expect(references).toHaveLength(1);
    expect(references[0]!.endsWith("/notes.pdf")).toBe(true);
  });

  it("rejects a missing path instead of passing it to the model", async () => {
    await expect(service.resolve(["nope.pdf"], cwd)).rejects.toThrow(/Attachment not found: nope\.pdf/);
  });

  it("rejects a folder", async () => {
    const folder = join(cwd, "subfolder");
    await mkdir(folder, { recursive: true });

    await expect(service.resolve([folder], cwd)).rejects.toThrow(/folder, not a file/);
  });

  it("accepts a file URL as handed over by a file manager drop", async () => {
    const { references } = await service.resolve([`file://${pdfPath}`], cwd);

    expect(references[0]!.endsWith("/notes.pdf")).toBe(true);
  });

  it("leaves a plain path untouched when stripping file URLs", () => {
    expect(stripFileUrl("/tmp/a b.pdf")).toBe("/tmp/a b.pdf");
    expect(stripFileUrl("file:///tmp/a%20b.pdf")).toBe("/tmp/a b.pdf");
  });
});

describe("withReferences", () => {
  it("appends canonical paths as an explicit block", () => {
    expect(withReferences("Summarise this", ["/tmp/a.pdf"])).toBe(
      "Summarise this\n\nAttached files (local paths):\n- /tmp/a.pdf",
    );
  });

  it("leaves the message alone when nothing is attached", () => {
    expect(withReferences("Hello", [])).toBe("Hello");
  });
});
