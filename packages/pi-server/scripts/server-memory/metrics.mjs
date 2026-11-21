import { execFileSync } from "node:child_process";
import { accessSync, constants } from "node:fs";

function requireSystemTool(path) {
  try { accessSync(path, constants.X_OK); }
  catch (cause) { throw new Error(`Required system tool is not executable: ${path}. PATH fallback is disabled.`, { cause }); }
}

export function rssKilobytes(pid) {
  if (process.platform !== "darwin" && process.platform !== "linux") {
    throw new Error(`Unsupported memory diagnostics platform: ${process.platform}`);
  }
  requireSystemTool("/bin/ps");
  return Number(execFileSync("/bin/ps", ["-p", String(pid), "-o", "rss="], { encoding: "utf8" }).trim());
}

export function physicalPeakMegabytes(pid) {
  if (process.platform !== "darwin") return undefined;
  requireSystemTool("/usr/bin/vmmap");
  const summary = execFileSync("/usr/bin/vmmap", ["-summary", String(pid)], { encoding: "utf8" });
  const match = summary.match(/Physical footprint \(peak\):\s+([\d.]+)([KMG])/);
  if (!match) return undefined;
  const scale = { K: 1 / 1024, M: 1, G: 1024 }[match[2]];
  return Number(match[1]) * scale;
}
