import assert from "node:assert/strict";
import { createPiServer } from "@manuelselch/pi-server";
import { PROTOCOL_VERSION } from "@manuelselch/pi-sdk/protocol";

assert.equal(typeof createPiServer, "function");
assert.equal(PROTOCOL_VERSION, 2);
console.log("Verified installed server public API and SDK protocol.");
