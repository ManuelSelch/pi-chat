import { expect, test } from "vitest";
import * as fileOpening from "../index.js";
import { filePathSchema } from "@manuelselch/pi-sdk/protocol";
import { fileOpeningContract } from "../../contract.js";

test("composes browser actions without declaring a plugin", () => {
  const actions = fileOpening.createFileOpeningActions(async () => { throw new Error("Not connected"); });

  expect(actions.openFile).toBeTypeOf("function");
  expect(fileOpening).not.toHaveProperty("createFileOpeningPlugin");
  expect(actions).not.toHaveProperty("id");
});

test("does not carry a host implementation in the browser entry", () => {
  expect("host" in fileOpening).toBe(false);
});

test("uses explicit app composition rather than an unimplemented web loader", () => {
  expect(fileOpening).not.toHaveProperty("web");
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
