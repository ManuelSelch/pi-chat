import { expect, test } from "vitest";
import { requestSchema, parseResponse } from "../../src/protocol/v2.js";

const request = {
  version: 2, type: "request", requestId: "counter-1", method: "plugin.call",
  params: { contractId: "test-counter", contractVersion: 1, method: "increment", input: null },
};

test("plugin calls use the existing correlated server-scoped request envelope", () => {
  expect(requestSchema.parse(request)).toEqual(request);
  expect(parseResponse("plugin.call", {
    version: 2, type: "response", requestId: "counter-1", ok: true, result: { value: 1 },
  })).toMatchObject({ ok: true, result: { value: 1 } });
});

test.each([
  { ...request, sessionId: "session" },
  { ...request, params: { ...request.params, contractVersion: 0 } },
  { ...request, params: { ...request.params, contractId: "" } },
  { ...request, params: { ...request.params, method: "" } },
  { ...request, params: { ...request.params, input: undefined } },
  { ...request, params: { ...request.params, input: Infinity } },
])("rejects invalid plugin envelopes %#", input => {
  expect(requestSchema.safeParse(input).success).toBe(false);
});
