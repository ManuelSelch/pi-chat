import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("leaves Swift SDK testing and artifacts outside Chat", () => {
  for (const path of [
    "test/swift-integration",
    "scripts/run-swift-integration.mjs",
    "scripts/sdk-artifacts.mjs",
    "vendor/pi-sdk-swift.bundle",
    "vendor/sdk-artifacts.json",
  ]) expect(existsSync(path), path).toBe(false);
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  expect(Object.keys(manifest.scripts).filter(name => /swift/i.test(name))).toEqual([]);
  const workflow = readFileSync(".github/workflows/tests.yml", "utf8");
  expect(workflow).not.toContain("swift-integration");
  expect(workflow).not.toContain("macos-");
});

it("keeps only the Chat-owned host and consumes the server without copied sources", () => {
  for (const path of ["src/server", "packages/pi-server", "tsconfig.server.json"]) expect(existsSync(path), path).toBe(false);
  function scan(directory: string): void {
    for (const file of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, file.name);
      if (file.isDirectory()) { if (!file.name.startsWith(".") && file.name !== "node_modules") scan(path); }
      else if (/\.(ts|tsx|js|mjs)$/.test(path)) {
        const source = readFileSync(path, "utf8");
        expect(source, path).not.toMatch(/(?:from|import\s*\()\s*["\x27][^"\x27]*(?:src\/server\/|pi-server\/dist\/)/);
        expect(source, path).not.toContain("dist/server/" + "server/index.js");
      }
    }
  }
  for (const path of ["src", "test", "scripts", "extension", "examples"]) scan(path);
});
