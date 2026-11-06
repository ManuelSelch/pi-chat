import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";

it("pins coordinated model-search snapshots with source receipts and lockfile integrity", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8"));
  const receipt = JSON.parse(await readFile(new URL("../../vendor/model-search/SOURCE.json", import.meta.url), "utf8"));
  for (const name of ["@manuelselch/pi-sdk"] as const) {
    const source = receipt.packages[name];
    const spec = `file:vendor/model-search/${source.archive}`;
    const bytes = await readFile(new URL(`../../vendor/model-search/${source.archive}`, import.meta.url));

    expect(source.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
    expect(manifest.dependencies[name]).toBe(spec);
    expect(lock.packages[""].dependencies[name]).toBe(spec);
    const installed = lock.packages[`node_modules/${name}`];
    expect(installed.version).toBe(source.version);
    expect(installed.resolved).toBe(spec);
    expect(installed.integrity).toBe(`sha512-${createHash("sha512").update(bytes).digest("base64")}`);
  }
  const server = JSON.parse(await readFile(new URL("../../vendor/live-checkouts/SOURCE.json", import.meta.url), "utf8"));
  const serverBytes = await readFile(new URL(`../../vendor/live-checkouts/${server.archive}`, import.meta.url));
  const serverSpec = `file:vendor/live-checkouts/${server.archive}`;
  expect(createHash("sha256").update(serverBytes).digest("hex")).toBe(server.sha256);
  expect(manifest.dependencies["@manuelselch/pi-server"]).toBe(serverSpec);
  expect(lock.packages[""].dependencies["@manuelselch/pi-server"]).toBe(serverSpec);
  expect(lock.packages["node_modules/@manuelselch/pi-server"]).toMatchObject({
    version: server.version, resolved: serverSpec,
    integrity: `sha512-${createHash("sha512").update(serverBytes).digest("base64")}`,
  });
  expect(lock.packages["node_modules/@manuelselch/pi-server/node_modules/@manuelselch/pi-sdk"]).toBeUndefined();
});

it("consumes the installed public server and protocol APIs", async () => {
  const { createPiServer } = await import("@manuelselch/pi-server");
  const { FakeRuntimeAdapter } = await import("@manuelselch/pi-server/testing");
  const { PROTOCOL_VERSION } = await import("@manuelselch/pi-sdk/protocol");
  expect(PROTOCOL_VERSION).toBe(2);
  const server = createPiServer({ runtime: new FakeRuntimeAdapter(), catalogue: { homeDirectory: null } });
  await server.close();
});
