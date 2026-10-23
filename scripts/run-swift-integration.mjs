import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifySDKArtifacts } from "./sdk-artifacts.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = verifySDKArtifacts();
const harness = join(root, "test/swift-integration");
const checkout = join(harness, ".sdk/pi-sdk-swift");
mkdirSync(join(harness, ".sdk"), { recursive: true });
if (!existsSync(checkout)) {
  execFileSync("git", ["clone", "--quiet", "--no-checkout", join(root, "vendor", manifest.swift.artifact), checkout]);
  execFileSync("git", ["-C", checkout, "checkout", "--quiet", "--detach", manifest.swift.revision]);
}
const revision = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.equal(revision, manifest.swift.revision, "Stale Swift fixture SDK: review/remove test/swift-integration/.sdk and retry.");
assert.equal(execFileSync("git", ["-C", checkout, "status", "--porcelain"], { encoding: "utf8" }).trim(), "", "Refusing modified fixture SDK checkout");
const agent = mkdtempSync(join(tmpdir(), "pi-swift-integration-agent-"));
try {
  execFileSync("xcrun", ["swift", "test", "--package-path", harness], {
    cwd: root,
    env: { ...process.env, PI_CODING_AGENT_DIR: agent },
    stdio: "inherit",
  });
} finally {
  rmSync(agent, { recursive: true, force: true });
}
