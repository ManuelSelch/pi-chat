import { expect, it } from "vitest";
import * as sdk from "@manuelselch/pi-sdk";
import * as contract from "@manuelselch/pi-sdk/protocol";
import * as shared from "../../../src/shared/protocol.js";
it("exports one authoritative v2 contract through SDK, contract-only and app re-exports", () => {
  expect(sdk.PROTOCOL_VERSION).toBe(2); expect(sdk.serverMessageSchema).toBe(contract.serverMessageSchema); expect(shared.serverMessageSchema).toBe(contract.serverMessageSchema);
  expect(sdk.requestSchema.parse({ version: 2, type: "request", requestId: "r", method: "message.send", sessionId: "runtime", params: { message: " hello ", additive: true }, future: true })).toEqual({ version: 2, type: "request", requestId: "r", method: "message.send", sessionId: "runtime", params: { message: "hello" } });
  expect("PiClient" in contract).toBe(false); expect(() => sdk.requestSchema.parse({ version: 1, type: "prompt", sessionId: "runtime", message: "hello" })).toThrow();
});
