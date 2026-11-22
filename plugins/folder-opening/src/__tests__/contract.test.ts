import { expect, test } from "vitest";
import { folderBrowseResultSchema, folderOpeningContract } from "../contract.js";

test("validates server folder browsing and safe domain failures", () => {
  const { input, output } = folderOpeningContract.methods.browse;
  expect(input.parse({ path: "../work", basePath: "/server", showHidden: true, cursor: "a" })).toMatchObject({ path: "../work", cursor: "a" });
  expect(() => input.parse({ path: "" })).toThrow();
  expect(output.parse({ ok: true, listing: { path: "/server", entries: [], breadcrumbs: [] } })).toMatchObject({ ok: true });
  expect(output.parse({ ok: false, error: { code: "listingChanged", message: "Refresh to continue." } })).toMatchObject({ ok: false });
  expect(() => output.parse({ ok: false, error: { code: "arbitrary", message: "Unsafe" } })).toThrow();
});

test.each(["invalidPath", "notFound", "permissionDenied", "listingChanged", "operationFailed"])("accepts the safe folder error %s", code => {
  const result = { ok: false, error: { code, message: "Unable to browse." } };

  expect(folderBrowseResultSchema.parse(result)).toEqual(result);
});

test.each(["", "x".repeat(513)])("rejects empty or oversized folder error messages", message => {
  const result = { ok: false, error: { code: "operationFailed", message } };

  expect(folderBrowseResultSchema.safeParse(result).success).toBe(false);
});

test("accepts the maximum folder error message length", () => {
  const result = { ok: false, error: { code: "operationFailed", message: "x".repeat(512) } };

  expect(folderBrowseResultSchema.parse(result)).toEqual(result);
});
