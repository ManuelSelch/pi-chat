import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { resolveNpmCli } from "../../../../src/shared/node/npm-command.ts";
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "pi-sdk-consumer-"));
try {
  execFileSync(process.execPath, [resolveNpmCli(), "pack", "--pack-destination", temporary], { cwd: root, stdio: "pipe" });
  const tarball = (await readdir(temporary)).find(name => name.endsWith(".tgz")); assert(tarball);
  await writeFile(join(temporary, "package.json"), JSON.stringify({ private: true, type: "module" }));
  execFileSync(process.execPath, [resolveNpmCli(), "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", join(temporary, tarball)], { cwd: temporary, stdio: "pipe" });
  const manifest = JSON.parse(await readFile(join(temporary, "node_modules/@manuelselch/pi-sdk/package.json"), "utf8")); assert.deepEqual(Object.keys(manifest.dependencies), ["zod"]);
  const modules = await readdir(join(temporary, "node_modules")); assert(!modules.some(name => ["react", "@mantine", "@earendil-works", "ws"].includes(name)));
  await writeFile(join(temporary, "consumer.ts"), `
import { PiClient, PROTOCOL_VERSION, type Request, type TransportFactory, type Result } from "@manuelselch/pi-sdk";
import { requestSchema, serverMessageSchema, type ServerMessage } from "@manuelselch/pi-sdk/protocol";
const command: Request<"run.abort"> = { version: PROTOCOL_VERSION, type: "request", requestId: "r", method: "run.abort", sessionId: "runtime", params: {} };
const event: ServerMessage = { version: 2, type: "protocolError", serverInstanceId: "server", error: { code: "example", message: "Example" } };
requestSchema.parse(command); serverMessageSchema.parse(event);
const transport: TransportFactory = (_endpoint, _handlers) => ({ send(_text) {}, close() {}, dispose() {} });
const client = new PiClient({ endpoint: "ws://example/ws", transport });
const pendingSession: Promise<string> = client.createSession();
const admission: Promise<Result<"message.send">> = client.prompt("runtime", "hello");
// @ts-expect-error State is deeply immutable.
client.getState().inventory.push({});
// @ts-expect-error Convenience controls always require explicit runtime identity.
client.prompt("missing target");
// @ts-expect-error Session wire requests require identity.
const missing: Request<"run.abort"> = { version: 2, type: "request", requestId: "r", method: "run.abort", params: {} };
// @ts-expect-error There is no v1 wire contract.
const old: Request<"run.abort"> = { version: 1, type: "request", requestId: "r", method: "run.abort", sessionId: "runtime", params: {} };
`);
  await writeFile(join(temporary, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2023", lib: ["ES2023"], types: [], module: "NodeNext", moduleResolution: "NodeNext", strict: true, skipLibCheck: true, noEmit: true }, files: ["consumer.ts"] }));
  const compiler = join(dirname(require.resolve("typescript/package.json")), "bin/tsc"); execFileSync(process.execPath, [compiler, "-p", "tsconfig.json"], { cwd: temporary, stdio: "pipe" });
  await writeFile(join(temporary, "consumer.mjs"), `
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import * as sdk from "@manuelselch/pi-sdk";
import * as contract from "@manuelselch/pi-sdk/protocol";
assert.equal(sdk.PROTOCOL_VERSION, 2); assert.equal(sdk.requestSchema, contract.requestSchema); assert.equal(contract.PiClient, undefined);
const samples = JSON.parse(readFileSync(new URL(import.meta.resolve("@manuelselch/pi-sdk/protocol/fixtures/v2/valid.json")), "utf8"));
for (const sample of samples.operations) { sdk.requestSchema.parse(sample.request); sdk.parseResponse(sample.method, sample.response); sdk.parseResponse(sample.method, sample.rejection); }
for (const event of samples.events) sdk.eventSchema.parse(event);
const schema = JSON.parse(readFileSync(new URL(import.meta.resolve("@manuelselch/pi-sdk/protocol/schema/v2/Request.schema.json")), "utf8")); assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(existsSync(new URL("./node_modules/@manuelselch/pi-sdk/dist/contract/protocol.js", import.meta.url)), false);
const callbacks = new Map(); let id = 0; let handlers; const sent = [];
const scheduler = { setTimeout(callback) { const key = ++id; callbacks.set(key, callback); return key; }, clearTimeout(key) { callbacks.delete(key); } };
const client = new sdk.PiClient({ endpoint: "wss://example/ws", scheduler, transport(endpoint, events) { assert.equal(endpoint, "wss://example/ws"); handlers = events; return { send(text) { sent.push(JSON.parse(text)); }, close() {}, dispose() {} }; } });
client.start(); const [timer, callback] = callbacks.entries().next().value; callbacks.delete(timer); callback(); handlers.open(); assert.equal(sent[0].method, "server.initialize");
const initial = samples.operations.find(s => s.method === "server.initialize").response.result;
handlers.message(JSON.stringify({ version: 2, type: "response", requestId: sent[0].requestId, ok: true, result: { ...initial, inventory: { revision: 0, sessions: [] }, snapshots: [] } }));
assert.equal(client.getState().connection.phase, "ready"); assert(Object.isFrozen(client.getState().inventory));
const created = client.createSession("/example"); assert.equal(sent[1].method, "session.create");
handlers.message(JSON.stringify({ version: 2, type: "response", requestId: sent[1].requestId, ok: true, result: samples.operations.find(s => s.method === "session.create").response.result }));
assert.equal(await created, "runtime"); assert.equal(client.getSession("runtime").settings.model, "p/m");
const prompt = client.prompt("runtime", "hello"); assert.equal(sent[2].method, "message.send"); handlers.message(JSON.stringify({ version: 2, type: "response", requestId: sent[2].requestId, ok: true, result: { state: "accepted", operationId: "op" } })); assert.equal((await prompt).state, "accepted");
client.dispose(); assert.equal(callbacks.size, 0); assert.equal(client.getState().connection.phase, "disposed");
`);
  execFileSync(process.execPath, ["consumer.mjs"], { cwd: temporary, stdio: "pipe" });
  console.log("Packed SDK verified offline: v2-only contract/artifacts, typed admission, lifecycle, clean output, dependency isolation and ES-only TypeScript consumer.");
} catch (error) { if (error.stdout) console.error(error.stdout.toString()); if (error.stderr) console.error(error.stderr.toString()); throw error; }
finally { await rm(temporary, { recursive: true, force: true }); }
