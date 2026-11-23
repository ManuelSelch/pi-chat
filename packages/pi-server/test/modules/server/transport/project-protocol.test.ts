import { expect, it } from "vitest";
import { requestSchema, parseResponse } from "@manuelselch/pi-sdk/protocol";
it("accepts correlated v2 archive/remove commands and structured results without a live runtime", () => {
  for (const [method, params] of [["session.archive", { path: "/history.jsonl", archived: true }], ["project.remove", { path: "/work" }]]) {
    const command = { version: 2, type: "request", requestId: "r", method, params };
    expect(requestSchema.safeParse(command).success).toBe(true); expect(requestSchema.safeParse({ ...command, requestId: undefined }).success).toBe(false);
  }
  expect(parseResponse("project.remove", { version: 2, type: "response", requestId: "r", ok: false, error: { code: "permissionDenied", message: "Unable to persist" } })).toMatchObject({ ok: false, error: { code: "permissionDenied" } });
});
