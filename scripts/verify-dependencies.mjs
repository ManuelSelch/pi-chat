import assert from "node:assert/strict";
import { createPiServer } from "@manuelselch/pi-server";
import { PROTOCOL_VERSION, operationSchemas } from "@manuelselch/pi-sdk/protocol";
import { PiClient } from "@manuelselch/pi-sdk";
import { definePlugin, defineRemoteContract } from "@manuelselch/pi-sdk/plugins";
import { fileOpeningContract } from "@manuelselch/pi-sdk/plugins/file-opening";
import { createPluginRuntime, createFileOpeningPlugin } from "@manuelselch/pi-server/plugins";

assert.equal(typeof createPiServer, "function");
assert.equal(PROTOCOL_VERSION, 2);
assert.equal(typeof definePlugin, "function");
assert.equal(typeof defineRemoteContract, "function");
assert.equal(typeof createPluginRuntime, "function");
assert.equal(typeof createFileOpeningPlugin, "function");
assert.equal(fileOpeningContract.id, "file-opening");
assert.equal(typeof PiClient.prototype.plugin, "function");
assert.equal(operationSchemas["plugin.call"].scope, "server");
assert.equal(operationSchemas["plugin.call"].capability, "plugin.call");
console.log("Verified installed server, plugin declarations/runtime and typed SDK RPC/protocol APIs.");
