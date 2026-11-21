import { realpath, readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("links the workspace SDK without bundling a private copy", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const sdk = JSON.parse(await readFile(new URL("../../../pi-sdk-typescript/package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../../../../package-lock.json", import.meta.url), "utf8"));

  expect(manifest.bundleDependencies ?? []).not.toContain("@manuelselch/pi-sdk");
  expect(manifest.bundledDependencies ?? []).not.toContain("@manuelselch/pi-sdk");
  expect(manifest.dependencies["@manuelselch/pi-sdk"]).toBe(sdk.version);
  expect(lock.packages["node_modules/@manuelselch/pi-sdk"]).toEqual({ resolved: "packages/pi-sdk-typescript", link: true });
  expect(lock.packages["packages/pi-server/node_modules/@manuelselch/pi-sdk"]).toBeUndefined();
  expect(await realpath(new URL("../../../../node_modules/@manuelselch/pi-sdk", import.meta.url)))
    .toBe(await realpath(new URL("../../../pi-sdk-typescript", import.meta.url)));
});
