import { expect, test } from "vitest";
import fileOpening from "../index.js";
import { filePathSchema } from "@manuelselch/pi-sdk/protocol";
import { fileOpeningContract } from "@manuelselch/pi-sdk/plugins/file-opening";

test("identifies the inactive file-opening plugin", () => {
  expect(fileOpening.id).toBe("file-opening");
  expect(fileOpening.requires).toEqual([fileOpeningContract]);
});

test("does not carry a host implementation in the browser plugin", () => {
  expect("host" in fileOpening).toBe(false);
});

test("keeps web setup explicitly unimplemented", async () => {
  const web = await fileOpening.web();

  expect(() => web.setup()).toThrow("File-opening web plugin is not implemented.");
});

test("requires an explicit runtime and validates file-opening results", () => {
  const { input, output } = fileOpeningContract.methods.open;

  expect(input.parse({ sessionId: "runtime-1", path: "readme.md" })).toEqual({ sessionId: "runtime-1", path: "readme.md" });
  expect(() => input.parse({ path: "readme.md" })).toThrow();
  expect(() => input.parse({ sessionId: "", path: "readme.md" })).toThrow();
  expect(output.parse({ ok: true })).toEqual({ ok: true });
  expect(() => output.parse({ ok: false, error: { code: "invented", message: "Error" } })).toThrow();
});

test("reuses the existing server-local path validation", () => {
  expect(filePathSchema.safeParse("docs/architecture.md").success).toBe(true);
  expect(filePathSchema.safeParse("https://example.com/file.txt").success).toBe(false);
});
