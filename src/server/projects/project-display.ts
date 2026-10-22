import os from "node:os";
import { basename, dirname } from "node:path";

const GENERIC_PROJECT_DIR_NAMES = new Set(["frontend", "backend", "web", "api", "server", "client", "app"]);

/** Display-only separators and trailing-slash removal, without regex retries. */
function normalizeDisplayPath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  let end = normalized.length;
  while (end > 0 && normalized[end - 1] === "/") end -= 1;
  return normalized.slice(0, end);
}

export function formatProjectName(projectPath: string): string {
  const normalizedPath = normalizeDisplayPath(projectPath);
  const child = basename(normalizedPath) || normalizedPath;
  if (!GENERIC_PROJECT_DIR_NAMES.has(child.toLowerCase())) return child;

  const parent = basename(dirname(normalizedPath));
  return parent ? `${parent}/${child}` : child;
}

export function formatProjectDisplayPath(projectPath: string, homePath = os.homedir()): string {
  if (!homePath) return projectPath;
  const normalizedPath = normalizeDisplayPath(projectPath);
  const normalizedHome = normalizeDisplayPath(homePath);
  const caseInsensitive = /^[A-Za-z]:\//.test(normalizedPath) || /^[A-Za-z]:\//.test(normalizedHome);
  const comparisonPath = caseInsensitive ? normalizedPath.toLowerCase() : normalizedPath;
  const comparisonHome = caseInsensitive ? normalizedHome.toLowerCase() : normalizedHome;

  if (comparisonPath === comparisonHome) return "~";
  if (comparisonPath.startsWith(`${comparisonHome}/`)) {
    return `~/${normalizedPath.slice(normalizedHome.length + 1)}`;
  }
  return normalizedPath;
}
