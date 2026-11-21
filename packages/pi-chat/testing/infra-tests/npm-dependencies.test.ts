import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("consumes the SDK and Server from version-matched workspaces without a private SDK copy", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../../../../package-lock.json", import.meta.url), "utf8"));
  for (const [name, path] of [["@manuelselch/pi-sdk", "packages/pi-sdk-typescript"], ["@manuelselch/pi-server", "packages/pi-server"]] as const) {
    expect(lock.packages[`node_modules/${name}`]).toEqual({ resolved: path, link: true });
    expect(lock.packages[path].version).toBe(manifest.dependencies[name]);
  }
  expect(lock.packages["packages/pi-server/node_modules/@manuelselch/pi-sdk"]).toBeUndefined();
  expect(lock.packages["packages/pi-server"].dependencies["@manuelselch/pi-sdk"]).toBe(manifest.dependencies["@manuelselch/pi-sdk"]);
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
