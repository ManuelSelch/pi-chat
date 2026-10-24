import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Verify the Swift-only fixture bundle; npm dependencies use lockfile integrity. */
export function verifySDKArtifacts(root = new URL("../", import.meta.url)) {
  const manifest = JSON.parse(readFileSync(new URL("vendor/sdk-artifacts.json", root), "utf8"));
  const record = manifest.swift;
  assert.match(record.revision, /^[0-9a-f]{40}$/, "Missing Swift revision");
  assert.match(record.artifact, /^[a-zA-Z0-9._-]+$/, "Unsafe artifact path");
  const actual = createHash("sha256").update(readFileSync(new URL(`vendor/${record.artifact}`, root))).digest("hex");
  assert.equal(actual, record.sha256, "Swift SDK artifact checksum mismatch");
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifySDKArtifacts();
  console.log("Verified pinned Swift SDK bundle checksum.");
}
