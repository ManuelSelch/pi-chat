import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "pi-sdk-consumer-"));
try {
  // Pack locally only. No registry publication and no sibling-source imports.
  execFileSync("npm", ["pack", "--pack-destination", temporary], { cwd: root, stdio: "pipe" });
  const tarball = (await readdir(temporary)).find((name) => name.endsWith(".tgz"));
  assert(tarball);
  await writeFile(join(temporary, "package.json"), JSON.stringify({ private: true, type: "module" }));
  execFileSync("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", join(temporary, tarball)], { cwd: temporary, stdio: "pipe" });
  const manifest = JSON.parse(await readFile(join(temporary, "node_modules/@manuelselch/pi-sdk/package.json"), "utf8"));
  assert.deepEqual(Object.keys(manifest.dependencies), ["zod"]);
  const modules = await readdir(join(temporary, "node_modules"));
  assert(!modules.some((name) => ["react", "@mantine", "@earendil-works", "ws"].includes(name)));

  await writeFile(join(temporary, "consumer.ts"), `
import { PROTOCOL_VERSION, parseClientMessage, type ClientMessage } from "@manuelselch/pi-sdk";
import { serverMessageSchema, type ServerMessage } from "@manuelselch/pi-sdk/contract";
const command: ClientMessage = { version: PROTOCOL_VERSION, type: "abort", sessionId: "runtime" };
const event: ServerMessage = { version: 1, type: "protocolError", error: "example" };
parseClientMessage(command);
serverMessageSchema.parse(event);
// @ts-expect-error Session commands must retain their required identity.
const missingSession: ClientMessage = { version: 1, type: "abort" };
// @ts-expect-error This is still v1, not the proposed v2 contract.
const wrongVersion: ClientMessage = { version: 2, type: "abort", sessionId: "runtime" };
`);
  await writeFile(join(temporary, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2023", lib: ["ES2023"], types: [], module: "NodeNext", moduleResolution: "NodeNext", strict: true, skipLibCheck: true, noEmit: true }, files: ["consumer.ts"] }));
  const compiler = join(dirname(require.resolve("typescript/package.json")), "bin/tsc");
  execFileSync(process.execPath, [compiler, "-p", "tsconfig.json"], { cwd: temporary, stdio: "pipe" });
  await writeFile(join(temporary, "consumer.mjs"), `
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as sdk from "@manuelselch/pi-sdk";
import * as contract from "@manuelselch/pi-sdk/contract";
assert.equal(sdk.PROTOCOL_VERSION, 1);
assert.equal(sdk.clientMessageSchema, contract.clientMessageSchema);
for (const file of ["valid", "invalid"]) {
  const samples = JSON.parse(readFileSync(new URL(import.meta.resolve("@manuelselch/pi-sdk/protocol/fixtures/v1/" + file + ".json")), "utf8"));
  for (const sample of samples) {
    const schema = sample.schema === "ClientMessage" ? sdk.clientMessageSchema : sample.schema === "ServerMessage" ? sdk.serverMessageSchema : undefined;
    if (schema) assert.equal(schema.safeParse(sample.input).success, file === "valid", sample.name);
  }
}
const schema = JSON.parse(readFileSync(new URL(import.meta.resolve("@manuelselch/pi-sdk/protocol/schema/v1/ClientMessage.schema.json")), "utf8"));
assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
`);
  execFileSync(process.execPath, ["consumer.mjs"], { cwd: temporary, stdio: "pipe" });
  console.log("Packed SDK installs offline and passes ESM imports, exported artifacts, v1 fixtures, dependency isolation and independent TypeScript checks.");
} catch (error) {
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  throw error;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
