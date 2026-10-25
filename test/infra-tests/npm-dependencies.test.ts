import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";

it("keeps the SDK registry-pinned and verifies the temporary colored-widget server archive", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8"));
  for (const name of ["@manuelselch/pi-sdk"]) {
    expect(manifest.dependencies[name]).toBe("0.1.0");
    expect(lock.packages[""].dependencies[name]).toBe("0.1.0");
    const installed = lock.packages[`node_modules/${name}`];
    expect(installed.version).toBe("0.1.0");
    expect(installed.resolved).toMatch(/^https:\/\/registry\.npmjs\.org\//);
    expect(installed.integrity).toMatch(/^sha512-/);
  }
  const receipt = JSON.parse(await readFile(new URL("../../vendor/widget-colors-server.json", import.meta.url), "utf8"));
  expect(receipt.sourceRevision).toMatch(/^[a-f0-9]{40}$/);
  const pin = `file:vendor/${receipt.tarball}`;
  expect(manifest.dependencies[receipt.package]).toBe(pin);
  expect(lock.packages[""].dependencies[receipt.package]).toBe(pin);
  const archive = await readFile(new URL(`../../vendor/${receipt.tarball}`, import.meta.url));
  expect(createHash("sha256").update(archive).digest("hex")).toBe(receipt.sha256);
  const installed = lock.packages[`node_modules/${receipt.package}`];
  expect(installed.version).toBe(receipt.version);
  expect(installed.resolved).toBe(pin);
  expect(installed.integrity).toBe(`sha512-${createHash("sha512").update(archive).digest("base64")}`);
});

it("consumes the installed public server and protocol APIs", async () => {
  const { createPiServer } = await import("@manuelselch/pi-server");
  const { FakeRuntimeAdapter } = await import("@manuelselch/pi-server/testing");
  const { PROTOCOL_VERSION } = await import("@manuelselch/pi-sdk/protocol");
  expect(PROTOCOL_VERSION).toBe(2);
  const server = createPiServer({ runtime: new FakeRuntimeAdapter(), catalogue: { homeDirectory: null } });
  await server.close();
});
