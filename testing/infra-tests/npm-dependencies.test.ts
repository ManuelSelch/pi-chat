import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("pins local SDK/server candidates to source revisions and archive integrity", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8"));
  const candidates = JSON.parse(await readFile(new URL("../../vendor/candidates.json", import.meta.url), "utf8"));
  for (const [name, candidate] of Object.entries(candidates) as [string, { archive: string; version: string; sourceRevision: string; sha256: string; integrity: string }][]) {
    const spec = "file:vendor/" + candidate.archive;
    const archive = await readFile(new URL("../../vendor/" + candidate.archive, import.meta.url));

    expect(candidate.sourceRevision).toMatch(/^[a-f0-9]{40}$/);
    expect(createHash("sha256").update(archive).digest("hex")).toBe(candidate.sha256);
    expect("sha512-" + createHash("sha512").update(archive).digest("base64")).toBe(candidate.integrity);
    expect(manifest.dependencies[name]).toBe(spec);
    expect(lock.packages[""].dependencies[name]).toBe(spec);
    expect(lock.packages[`node_modules/${name}`]).toMatchObject({
      version: candidate.version, resolved: spec, integrity: candidate.integrity,
    });
  }
  expect(Object.keys(candidates).sort()).toEqual(["@manuelselch/pi-sdk", "@manuelselch/pi-server"]);
  expect(lock.packages["node_modules/@manuelselch/pi-server/node_modules/@manuelselch/pi-sdk"]).toBeUndefined();
  expect(lock.packages["node_modules/@manuelselch/pi-server"].dependencies["@manuelselch/pi-sdk"]).toBe(candidates["@manuelselch/pi-sdk"].version);
});

it("consumes installed public server, plugin and protocol APIs", async () => {
  const { createPiServer } = await import("@manuelselch/pi-server");
  const { FakeRuntimeAdapter } = await import("@manuelselch/pi-server/testing");
  const { definePlugin } = await import("@manuelselch/pi-sdk/plugins");
  const { fileOpeningContract } = await import("@manuelselch/pi-sdk/plugins/file-opening");
  const { PROTOCOL_VERSION } = await import("@manuelselch/pi-sdk/protocol");
  expect(PROTOCOL_VERSION).toBe(2);
  expect(fileOpeningContract.id).toBe("file-opening");
  let active = false;
  let disposed = false;
  const plugin = definePlugin({ id: "consumer", host: async () => ({ setup(ctx) {
    active = true;
    ctx.onCleanup(() => { disposed = true; });
  } }) });

  const server = await createPiServer({ plugins: [plugin], runtime: new FakeRuntimeAdapter(), catalogue: { homeDirectory: null } });
  expect(active).toBe(true);
  await server.close();
  expect(disposed).toBe(true);
});
