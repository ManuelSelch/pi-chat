import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Check exact artifacts before consuming unpublished local SDK releases. */
export function verifySDKArtifacts(root = new URL("../", import.meta.url)) {
  const manifest = JSON.parse(readFileSync(new URL("vendor/sdk-artifacts.json", root), "utf8"));
  for (const language of ["typescript", "swift"]) {
    const record = manifest[language];
    assert.match(record.revision, /^[0-9a-f]{40}$/, `Missing ${language} revision`);
    assert.match(record.artifact, /^[a-zA-Z0-9._-]+$/, "Unsafe artifact path");
    const actual = createHash("sha256").update(readFileSync(new URL(`vendor/${record.artifact}`, root))).digest("hex");
    assert.equal(actual, record.sha256, `${language} SDK artifact checksum mismatch`);
  }
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifySDKArtifacts();
  const protocol = await import("@manuelselch/pi-sdk/protocol");
  assert.equal(protocol.PROTOCOL_VERSION, 2);
  console.log("Verified installed protocol and pinned SDK artifact checksums.");
}
