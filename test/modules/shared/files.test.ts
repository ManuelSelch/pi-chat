import { describe, expect, it } from "vitest";
import { requestSchema, parseResponse, PROTOCOL_VERSION, serverMessageSchema } from "../../../src/shared/protocol.js";
const request = { version: PROTOCOL_VERSION, type: "request", method: "file.open", sessionId: "session-a", requestId: "file-1", params: { path: "../report.pdf" } };
const reply = { version: PROTOCOL_VERSION, type: "response", requestId: "file-1" };
describe("v2 server-local file capability", () => {
  it("carries explicit ownership and an extracted literal path, not a shell command", () => { expect(requestSchema.parse(request)).toEqual(request); });
  it.each(["/tmp/a #?.pdf", "../a'b.pdf", "-report.pdf", "./résumé.pdf", "100%.pdf", " report.pdf "])("preserves literal path %s", path => { expect(requestSchema.parse({ ...request, params: { path } })).toMatchObject({ params: { path } }); });
  it.each(["", " ", "file:///tmp/a", "https://example/a", "//host/a", "\\\\host\\a", "x\u0000y", "x\ny", "x\ty", "a".repeat(4097)])("rejects invalid path %j", path => { expect(() => requestSchema.parse({ ...request, params: { path } })).toThrow(); });
  for (const key of ["sessionId", "requestId"]) it.each(["", "a\u0000b", "x\ny", "x".repeat(129)])(`rejects invalid ${key} %j`, value => { expect(() => requestSchema.parse({ ...request, [key]: value })).toThrow(); });
  it("reports completed file opening as an unsequenced correlated result", () => { expect(parseResponse("file.open", { ...reply, ok: true, result: { state: "completed" } })).toEqual({ ...reply, ok: true, result: { state: "completed" } }); });
  it.each(["invalidPath", "sessionNotFound", "notFound", "notFile", "permissionDenied", "unsupported", "openFailed", "futureCode"])("preserves structured recoverable %s rejection", code => { expect(parseResponse("file.open", { ...reply, ok: false, error: { code, message: "Unable to open on the server." } })).toMatchObject({ ok: false, error: { code } }); });
  it("rejects malformed successes and failures", () => {
    expect(() => parseResponse("file.open", { ...reply, ok: true, result: { ok: true } })).toThrow();
    for (const error of [null, "failure", {}, { code: "notFound" }]) expect(serverMessageSchema.safeParse({ ...reply, ok: false, error }).success).toBe(false);
  });
});
