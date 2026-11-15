import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("pins published server and SDK releases with lockfile integrity", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8"));
  for (const [name, version] of Object.entries({ "@manuelselch/pi-sdk": "0.2.1", "@manuelselch/pi-server": "0.3.0" })) {
    expect(manifest.dependencies[name]).toBe(version);
    expect(lock.packages[""].dependencies[name]).toBe(version);
    expect(lock.packages[`node_modules/${name}`]).toMatchObject({ version, integrity: expect.stringMatching(/^sha512-/) });
  }
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
