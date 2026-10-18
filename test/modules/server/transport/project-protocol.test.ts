import { expect, it } from "vitest";
import { requestSchema, parseResponse } from "@manuelselch/pi-sdk/contract";
it("accepts correlated v2 archive/pin commands and structured results without a live runtime", () => {
  for (const [method, params] of [["session.archive", { path: "/history.jsonl", archived: true }], ["project.pin", { path: "/work", pinned: true }]]) {
    const command = { version: 2, type: "request", requestId: "r", method, params };
    expect(requestSchema.safeParse(command).success).toBe(true); expect(requestSchema.safeParse({ ...command, requestId: undefined }).success).toBe(false);
  }
  expect(parseResponse("project.pin", { version: 2, type: "response", requestId: "r", ok: false, error: { code: "permissionDenied", message: "Unable to persist" } })).toMatchObject({ ok: false, error: { code: "permissionDenied" } });
});
