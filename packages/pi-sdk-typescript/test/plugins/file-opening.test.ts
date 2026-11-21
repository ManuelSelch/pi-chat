import { expect, expectTypeOf, test } from "vitest";
import { fileOpeningContract, type FileOpeningContract, type OpenFileInput } from "../../src/plugins/file-opening.js";

test("requires explicit runtime identity and validates server-local paths/results", () => {
  const { input, output } = fileOpeningContract.methods.open;

  expect(input.parse({ sessionId: "runtime-1", path: "readme.md" })).toEqual({ sessionId: "runtime-1", path: "readme.md" });
  expect(() => input.parse({ path: "readme.md" })).toThrow();
  expect(() => input.parse({ sessionId: "", path: "readme.md" })).toThrow();
  expect(() => input.parse({ sessionId: "runtime-1", path: "https://example.com/file" })).toThrow();
  expect(output.parse({ ok: true })).toEqual({ ok: true });
  expect(() => output.parse({ ok: false, error: { code: "invented", message: "Error" } })).toThrow();
  expectTypeOf<FileOpeningContract["open"]>().parameter(0).toEqualTypeOf<OpenFileInput>();
});
