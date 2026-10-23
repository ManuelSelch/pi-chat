import { readFile, readdir, access } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CoverageReport } from "monocart-coverage-reports";

const root = process.cwd();
const outputDir = resolve("coverage-e2e");

export function isAppSource(path) {
  return ["src/web/", "src/host/", "src/shared/"].some(prefix => path.startsWith(prefix)) && !path.split("/").includes("..") && /\.(ts|tsx)$/.test(path) && !path.endsWith(".d.ts");
}

function appUrl(url) {
  if (!url.startsWith("file:")) return false;
  return isAppSource(relative(root, fileURLToPath(url)).replaceAll("\\", "/"));
}

export function validateNodeData(data) {
  let count = 0;
  for (const entry of data.result ?? []) {
    if (!appUrl(entry.url)) continue;
    const cached = data["source-map-cache"]?.[entry.url];
    if (!cached?.data?.mappings || !cached.data.sourcesContent?.length || !cached.lineLengths?.length) {
      throw new Error(`Missing backend transform map: ${entry.url}`);
    }
    count++;
  }
  return count;
}

const mapKey = (map) => createHash("sha256").update(JSON.stringify([map.mappings, map.sourcesContent])).digest("hex");

export function recoverNodeEntries(data, transforms) {
  validateNodeData(data);
  return (data.result ?? []).filter((entry) => appUrl(entry.url)).map((entry) => {
    const cached = data["source-map-cache"][entry.url];
    const source = transforms.get(mapKey(cached.data));
    if (source === undefined || JSON.stringify(source.split("\n").map((line) => line.length)) !== JSON.stringify(cached.lineLengths)) {
      throw new Error(`Missing or mismatched backend transformed source: ${entry.url}`);
    }
    return { ...entry, source, sourceMap: cached.data };
  });
}

async function readTransforms(dir) {
  const transforms = new Map();
  for (const name of await readdir(dir, { recursive: true })) {
    if (!name.endsWith(".map")) continue;
    const map = JSON.parse(await readFile(join(dir, name), "utf8"));
    const content = await readFile(join(dir, name.replace(/\.map$/, ".js")), "utf8");
    // Playwright prefixes its cached code with a SHA-1 header, not executed code.
    const newline = content.indexOf("\n");
    const source = content.slice(newline + 1);
    const hash = createHash("sha1").update(source).digest("hex");
    if (content.slice(0, newline) !== `// ${hash}`) throw new Error(`Invalid Playwright transform cache: ${name}`);
    transforms.set(mapKey(map), source);
  }
  return transforms;
}

export function validateLcov(lcov) {
  let browser = false;
  for (const record of lcov.split("end_of_record")) {
    const path = record.match(/^SF:(.+)$/m)?.[1];
    if (!path) continue;
    if (!isAppSource(path)) throw new Error(`Coverage outside application scope: ${path}`);
    const executed = [...record.matchAll(/^DA:\d+,(\d+)/gm)].some((match) => Number(match[1]) > 0);
    browser ||= path.startsWith("src/web/") && executed;
  }
  if (!browser) throw new Error("Missing executed browser coverage");
  // Server package coverage belongs to pi-server CI; no copied/private server sources here.
}

export async function generateReport() {
  const browserDir = join(outputDir, "raw/browser");
  const nodeDir = join(outputDir, "raw/node");
  const report = new CoverageReport({
    baseDir: root,
    outputDir,
    clean: false, // Raw input lives here; never delete it during conversion.
    cleanCache: true,
    reports: ["lcovonly", "console-summary"],
    entryFilter: (entry) => appUrl(entry.url) || entry.url.startsWith(pathToFileURL(resolve("dist/web") + "/").href),
    sourceFilter: isAppSource,
    outputFilter: (entry) => isAppSource(entry.sourcePath),
  });
  let browserCount = 0;
  for (const name of await readdir(browserDir)) {
    const entries = JSON.parse(await readFile(join(browserDir, name), "utf8"));
    const mapped = [];
    for (const entry of entries) {
      if (!/^https?:/.test(entry.url)) continue;
      const pathname = new URL(entry.url).pathname;
      if (!pathname.startsWith("/assets/") || !pathname.endsWith(".js")) continue;
      const bundle = resolve("dist/web", `.${pathname}`);
      if (relative(resolve("dist/web"), bundle).startsWith("..")) throw new Error("Invalid bundle path");
      const source = await readFile(bundle, "utf8");
      if (source !== entry.source) throw new Error(`Coverage bundle does not match local build: ${pathname}`);
      const map = JSON.parse(await readFile(`${bundle}.map`, "utf8"));
      if (!map.mappings || !map.sourcesContent?.length) throw new Error(`Missing browser source map: ${pathname}`);
      // Resolve relative Vite sources against this exact bundle, not the reporting cwd.
      map.sources = map.sources.map((sourcePath) => new URL(sourcePath, pathToFileURL(bundle)).href);
      mapped.push({ ...entry, url: pathToFileURL(bundle).href, sourceMap: map });
    }
    if (mapped.length) {
      browserCount += mapped.length;
      await report.add(mapped);
    }
  }
  if (!browserCount) throw new Error("Missing browser coverage segments");
  const transforms = await readTransforms(join(outputDir, "raw/transforms"));
  for (const name of await readdir(nodeDir)) {
    if (!name.endsWith(".json")) continue;
    const entries = recoverNodeEntries(JSON.parse(await readFile(join(nodeDir, name), "utf8")), transforms);
    if (entries.length) {
      await report.add(entries);
    }
  }
  // E2E workers may execute only the external server package. Browser coverage is mandatory;
  // Chat host coverage is owned by Vitest and lifecycle smoke, not fabricated from dependency JS.
  await report.generate();
  const lcov = await readFile(join(outputDir, "lcov.info"), "utf8");
  validateLcov(lcov);
  for (const match of lcov.matchAll(/^SF:(.+)$/gm)) await access(resolve(root, match[1]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateReport();
