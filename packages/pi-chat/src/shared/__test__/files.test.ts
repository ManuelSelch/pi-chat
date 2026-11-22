import { describe, expect, it } from "vitest";
import { fileOpeningContract } from "@manuelselch/pi-plugin-file-opening";
import { requestSchema, parseResponse, PROTOCOL_VERSION, serverMessageSchema } from "../protocol.js";
const input = { sessionId: "session-a", path: "../report.pdf" };
const request = { version: PROTOCOL_VERSION, type: "request", method: "plugin.call", requestId: "file-1", params: { contractId: fileOpeningContract.id, contractVersion: 1, method: "open", input } };
const reply = { version: PROTOCOL_VERSION, type: "response", requestId: "file-1" };
const openInput = fileOpeningContract.methods.open.input;
describe("plugin-owned server-local file capability", () => {
  it("carries explicit ownership and a literal path through the sole generic invocation route", () => {
    expect(requestSchema.parse(request)).toEqual(request);
    expect(openInput.parse(input)).toEqual(input);
    expect(requestSchema.safeParse({ ...request, method: "file.open" }).success).toBe(false);
  });
  it.each(["/tmp/a #?.pdf", "../a'b.pdf", "-report.pdf", "./résumé.pdf", "100%.pdf", " report.pdf "])("preserves literal path %s", path => { expect(openInput.parse({ ...input, path })).toMatchObject({ path }); });
  it.each(["", " ", "file:///tmp/a", "https://example/a", "//host/a", "\\\\host\\a", "x\u0000y", "x\ny", "x\ty", "a".repeat(4097)])("rejects invalid path %j", path => { expect(() => openInput.parse({ ...input, path })).toThrow(); });
  it.each(["", "a\u0000b", "x\ny", "x".repeat(129)])("rejects invalid session identity %j", sessionId => { expect(() => openInput.parse({ ...input, sessionId })).toThrow(); });
  it.each(["", "a\u0000b", "x\ny", "x".repeat(129)])("rejects invalid request identity %j", requestId => { expect(() => requestSchema.parse({ ...request, requestId })).toThrow(); });
  it("reports file acceptance as an unsequenced correlated plugin result", () => {
    const response = { ...reply, ok: true, result: { value: { ok: true } } };
    expect(parseResponse("plugin.call", response)).toEqual(response);
    expect(fileOpeningContract.methods.open.output.parse(response.result.value)).toEqual({ ok: true });
  });
  it.each(["invalidPath", "sessionUnavailable", "notFound", "notFile", "permissionDenied", "unsupported", "openFailed"])("preserves structured recoverable %s failure", code => {
    const value = { ok: false, error: { code, message: "Unable to open on the server." } };
    expect(fileOpeningContract.methods.open.output.parse(value)).toEqual(value);
  });
  it("rejects malformed successes and failures", () => {
    expect(() => parseResponse("plugin.call", { ...reply, ok: true, result: { ok: true } })).toThrow();
    expect(() => fileOpeningContract.methods.open.output.parse({ state: "completed" })).toThrow();
    for (const error of [null, "failure", {}, { code: "notFound" }]) expect(serverMessageSchema.safeParse({ ...reply, ok: false, error }).success).toBe(false);
  });
});
