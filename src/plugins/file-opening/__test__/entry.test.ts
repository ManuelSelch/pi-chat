import { expect, test } from "vitest";
import fileOpening from "../index.js";
import { filePathSchema } from "../contract.js";

test("identifies the inactive file-opening plugin", () => {
  expect(fileOpening.id).toBe("file-opening");
});

test("keeps host setup explicitly unimplemented", async () => {
  const host = await fileOpening.host();

  expect(() => host.setup()).toThrow("File-opening host plugin is not implemented.");
});

test("keeps web setup explicitly unimplemented", async () => {
  const web = await fileOpening.web();

  expect(() => web.setup()).toThrow("File-opening web plugin is not implemented.");
});

test("reuses the existing server-local path validation", () => {
  expect(filePathSchema.safeParse("docs/architecture.md").success).toBe(true);
  expect(filePathSchema.safeParse("https://example.com/file.txt").success).toBe(false);
});
