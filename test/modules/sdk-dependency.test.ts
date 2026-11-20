import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("installs the integrity-pinned candidate SDK without bundling a private copy", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8"));
  const sdk = lock.packages["node_modules/@manuelselch/pi-sdk"];

  expect(manifest.bundleDependencies ?? []).not.toContain("@manuelselch/pi-sdk");
  expect(manifest.bundledDependencies ?? []).not.toContain("@manuelselch/pi-sdk");
  expect(lock.packages[""].dependencies["@manuelselch/pi-sdk"]).toBe(manifest.dependencies["@manuelselch/pi-sdk"]);
  expect(sdk.version).toBe(manifest.dependencies["@manuelselch/pi-sdk"]);
  expect(sdk.resolved).toMatch(/^file:vendor\/manuelselch-pi-sdk-[^/]+\.tgz$/);
  const archive = await readFile(new URL("../../" + sdk.resolved.slice(5), import.meta.url));
  expect(sdk.integrity).toBe("sha512-" + createHash("sha512").update(archive).digest("base64"));
});
