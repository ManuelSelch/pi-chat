import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("pins coordinated SDK and server package snapshots with verified integrity", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8"));
  for (const [name, version] of [["@manuelselch/pi-sdk", "0.1.1"], ["@manuelselch/pi-server", "0.1.2"]] as const) {
    const specifier = manifest.dependencies[name];
    expect(specifier).toMatch(/^file:vendor\/pi-(sdk|server)-[\w.-]+\.tgz$/);
    expect(lock.packages[""].dependencies[name]).toBe(specifier);
    const installed = lock.packages[`node_modules/${name}`];
    expect(installed.version).toBe(version);
    expect(installed.resolved).toBe(specifier);
    const archive = await readFile(new URL(`../../${specifier.slice(5)}`, import.meta.url));
    expect(installed.integrity).toBe(`sha512-${createHash("sha512").update(archive).digest("base64")}`);
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
