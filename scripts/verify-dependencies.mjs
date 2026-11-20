import assert from "node:assert/strict";
import { createPiServer } from "@manuelselch/pi-server";
import { PROTOCOL_VERSION } from "@manuelselch/pi-sdk/protocol";
import { definePlugin, defineRemoteContract } from "@manuelselch/pi-sdk/plugins";
import { fileOpeningContract } from "@manuelselch/pi-sdk/plugins/file-opening";
import { createPluginRuntime } from "@manuelselch/pi-server/plugins";

assert.equal(typeof createPiServer, "function");
assert.equal(PROTOCOL_VERSION, 2);
assert.equal(typeof definePlugin, "function");
assert.equal(typeof defineRemoteContract, "function");
assert.equal(typeof createPluginRuntime, "function");
assert.equal(fileOpeningContract.id, "file-opening");
console.log("Verified installed server, plugin declarations/runtime and SDK protocol APIs.");
