import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, it } from "vitest";
// @ts-expect-error Build tooling is native JavaScript, not a production dependency.
import { verifySDKArtifacts } from "../../scripts/sdk-artifacts.mjs";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
it("accepts the pinned Swift bundle without an npm SDK artifact and rejects changed bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-sdk-artifacts-")); roots.push(root);
  await mkdir(join(root, "vendor"));
  const record = { artifact: "fixture.tgz", revision: "a".repeat(40), sha256: createHash("sha256").update("original").digest("hex") };
  await writeFile(join(root, "vendor", record.artifact), "original");
  await writeFile(join(root, "vendor/sdk-artifacts.json"), JSON.stringify({ swift: record }));
  expect(verifySDKArtifacts(pathToFileURL(root + "/")).swift.revision).toBe(record.revision);
  await writeFile(join(root, "vendor", record.artifact), "tampered");
  expect(() => verifySDKArtifacts(pathToFileURL(root + "/"))).toThrow(/checksum/i);
  await writeFile(join(root, "vendor/sdk-artifacts.json"), JSON.stringify({ swift: { ...record, artifact: "../fixture.tgz" } }));
  expect(() => verifySDKArtifacts(pathToFileURL(root + "/"))).toThrow(/unsafe/i);
  await writeFile(join(root, "vendor/sdk-artifacts.json"), JSON.stringify({ swift: { ...record, revision: "invalid" } }));
  expect(() => verifySDKArtifacts(pathToFileURL(root + "/"))).toThrow(/revision/i);
});
