import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("pins the published SDK and server releases with registry integrity", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8"));
  for (const [name, version] of [["@manuelselch/pi-sdk", "0.1.0"], ["@manuelselch/pi-server", "0.1.2"]] as const) {
    expect(manifest.dependencies[name]).toBe(version);
    expect(lock.packages[""].dependencies[name]).toBe(version);
    const installed = lock.packages[`node_modules/${name}`];
    expect(installed.version).toBe(version);
    expect(installed.resolved).toMatch(/^https:\/\/registry\.npmjs\.org\//);
    expect(installed.integrity).toMatch(/^sha512-/);
  }
});

it("consumes the installed public server and protocol APIs", async () => {
  const { createPiServer } = await import("@manuelselch/pi-server");
  const { FakeRuntimeAdapter } = await import("@manuelselch/pi-server/testing");
  const { PROTOCOL_VERSION } = await import("@manuelselch/pi-sdk/protocol");
  expect(PROTOCOL_VERSION).toBe(2);
  const server = createPiServer({ runtime: new FakeRuntimeAdapter(), catalogue: { homeDirectory: null } });
  await server.close();
});
