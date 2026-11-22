import { expect, test } from "vitest";
import { folderOpeningContract } from "../index.js";

test("validates server folder browsing and safe domain failures", () => {
  const { input, output } = folderOpeningContract.methods.browse;
  expect(input.parse({ path: "../work", basePath: "/server", showHidden: true, cursor: "a" })).toMatchObject({ path: "../work", cursor: "a" });
  expect(() => input.parse({ path: "" })).toThrow();
  expect(output.parse({ ok: true, listing: { path: "/server", entries: [], breadcrumbs: [] } })).toMatchObject({ ok: true });
  expect(output.parse({ ok: false, error: { code: "listingChanged", message: "Refresh to continue." } })).toMatchObject({ ok: false });
  expect(() => output.parse({ ok: false, error: { code: "arbitrary", message: "Unsafe" } })).toThrow();
});
