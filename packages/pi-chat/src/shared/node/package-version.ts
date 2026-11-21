import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Read the installed manifest alongside the package's public dist entry. */
export function packageVersion(entryUrl: string): string {
  const manifest = JSON.parse(readFileSync(join(dirname(fileURLToPath(entryUrl)), "..", "package.json"), "utf8"));
  if (typeof manifest.version !== "string" || !manifest.version) throw new Error("Package version is missing");
  return manifest.version;
}
