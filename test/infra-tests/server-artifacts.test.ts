import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, it } from "vitest";
// @ts-expect-error Native JS build tooling.
import { verifyServerArtifact } from "../../scripts/server-artifact.mjs";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
it("accepts pinned server provenance and rejects changed bytes and unsafe paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-server-artifact-")); roots.push(root);
  await mkdir(join(root, "vendor"));
  const record = { repository: "pi-server", version: "0.0.0", artifact: "server.tgz", revision: "a".repeat(40), sourceRevision: "b".repeat(40), sha256: createHash("sha256").update("original").digest("hex") };
  const receipt = join(root, "vendor/server-artifact.json");
  await writeFile(join(root, "vendor", record.artifact), "original");
  await writeFile(receipt, JSON.stringify(record));
  expect(verifyServerArtifact(pathToFileURL(root + "/"))).toEqual(record);
  await writeFile(join(root, "vendor", record.artifact), "tampered");
  expect(() => verifyServerArtifact(pathToFileURL(root + "/"))).toThrow(/checksum/i);
  await writeFile(receipt, JSON.stringify({ ...record, artifact: "../server.tgz" }));
  expect(() => verifyServerArtifact(pathToFileURL(root + "/"))).toThrow(/unsafe/i);
});
it("consumes the pinned installed server through documented public exports", async () => {
  const { createPiServer } = await import("@manuelselch/pi-server");
  const { FakeRuntimeAdapter } = await import("@manuelselch/pi-server/testing");
  expect(verifyServerArtifact().version).toBe("0.0.0");
  const server = createPiServer({ runtime: new FakeRuntimeAdapter(), catalogue: { homeDirectory: null } });
  await server.close();
});
