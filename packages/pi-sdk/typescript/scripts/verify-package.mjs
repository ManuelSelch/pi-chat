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
import { PiClient, PROTOCOL_VERSION, parseClientMessage, type ClientMessage, type TransportFactory } from "@manuelselch/pi-sdk";
import { serverMessageSchema, type ServerMessage } from "@manuelselch/pi-sdk/contract";
const command: ClientMessage = { version: PROTOCOL_VERSION, type: "abort", sessionId: "runtime" };
const event: ServerMessage = { version: 1, type: "protocolError", error: "example" };
parseClientMessage(command);
serverMessageSchema.parse(event);
const transport: TransportFactory = (_endpoint, _handlers) => ({ send(_text) {}, close() {}, dispose() {} });
const client = new PiClient({ endpoint: "ws://example/ws", transport });
const pendingSession: Promise<string> = client.createSession();
// @ts-expect-error Published state is deeply readonly, including collection elements.
client.getState().inventory.push({});
// @ts-expect-error Routing is explicit, not browser focus-dependent.
client.prompt("message without a target session");
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
assert.equal(contract.PiClient, undefined);
const callbacks = new Map(); let timerSequence = 0; let handlers; const sent = [];
const scheduler = { setTimeout(callback) { const id = ++timerSequence; callbacks.set(id, callback); return id; }, clearTimeout(id) { callbacks.delete(id); } };
const client = new sdk.PiClient({ endpoint: "wss://example/ws", scheduler, transport(endpoint, events) {
  assert.equal(endpoint, "wss://example/ws"); handlers = events;
  return { send(text) { sent.push(JSON.parse(text)); }, close() {}, dispose() {} };
} });
client.start();
const [timer, callback] = callbacks.entries().next().value; callbacks.delete(timer); callback();
handlers.open();
handlers.message(JSON.stringify({ version: 1, type: "tabs", tabs: [], activeSessionId: "" }));
handlers.message(JSON.stringify({ version: 1, type: "catalogue", catalogue: { projects: [] } }));
assert.equal(client.getState().connection.phase, "ready");
assert(Object.isFrozen(client.getState().inventory));
const created = client.createSession("/example");
assert.equal(sent[0].type, "newSession");
handlers.message(JSON.stringify({ version: 1, type: "sessionOpened", requestId: sent[0].requestId, sessionId: "created" }));
assert.equal(await created, "created");
client.prompt("created", "hello"); assert.equal(sent[1].type, "prompt");
client.dispose(); assert.equal(callbacks.size, 0);
assert.equal(client.getState().connection.phase, "disposed");
`);
  execFileSync(process.execPath, ["consumer.mjs"], { cwd: temporary, stdio: "pipe" });
  console.log("Packed SDK installs offline and passes ESM imports, contract isolation, v1 fixtures, PiClient lifecycle/operations, dependency isolation and ES-only TypeScript checks.");
} catch (error) {
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  throw error;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
