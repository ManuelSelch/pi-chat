import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve("coverage-e2e");
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "raw/browser"), { recursive: true });
await mkdir(resolve(output, "raw/node"), { recursive: true });

// Only the Playwright process tree gets native Node coverage, not build/report tools.
const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, PI_CHAT_COVERAGE: "1", NODE_V8_COVERAGE: resolve(output, "raw/node"), PWTEST_CACHE_DIR: resolve(output, "raw/transforms") },
});
const code = await new Promise((resolveExit, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => resolveExit(signal ? 1 : code ?? 1));
});
if (code !== 0) process.exitCode = code;
else {
  const { generateReport } = await import("./report-playwright-coverage.mjs");
  await generateReport();
}
