import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("keeps only the Chat-owned host and consumes the server without copied sources", () => {
  for (const path of ["src/server", "packages/pi-server", "tsconfig.server.json", "test/swift-integration/fixtures/loopback-server.ts"]) expect(existsSync(path), path).toBe(false);
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
