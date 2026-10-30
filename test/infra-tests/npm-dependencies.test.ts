import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("pins coordinated SDK and server registry releases with lockfile integrity", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8"));
  for (const name of ["@manuelselch/pi-sdk", "@manuelselch/pi-server"] as const) {
    expect(manifest.dependencies[name]).toBe("0.2.0");
    expect(lock.packages[""].dependencies[name]).toBe("0.2.0");
    const installed = lock.packages[`node_modules/${name}`];
    expect(installed.version).toBe("0.2.0");
    expect(installed.resolved).toBe(`https://registry.npmjs.org/${name}/-/pi-${name.endsWith("pi-sdk") ? "sdk" : "server"}-0.2.0.tgz`);
    expect(installed.integrity).toMatch(/^sha512-[A-Za-z0-9+/]+={0,2}$/);
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
