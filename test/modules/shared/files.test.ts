import { describe, expect, it } from "vitest";
import { parseClientMessage, PROTOCOL_VERSION, serverMessageSchema } from "../../../src/shared/protocol.js";

const request = { version: PROTOCOL_VERSION, type: "openFile", sessionId: "session-a", requestId: "file-1", path: "../report.pdf" };
const reply = { version: PROTOCOL_VERSION, type: "fileOpenResult", sessionId: "session-a", requestId: "file-1" };

describe("file capability protocol", () => {
  it("carries explicit session ownership and an extracted path, without a command", () => {
    expect(parseClientMessage(request)).toEqual(request);
  });

  it.each(["/tmp/a #?.pdf", "../a'b.pdf", "-report.pdf", "./résumé.pdf", "100%.pdf", " report.pdf "])("preserves literal path %s", (path) => {
    expect(parseClientMessage({ ...request, path })).toMatchObject({ path });
  });

  it.each(["", "   ", "a\0.pdf", "a\n.pdf", "a\t.pdf", "a\u007f.pdf", "a\u0085.pdf", "x".repeat(4097), "file:///tmp/a", "https://host/a", "//host/a", "\\\\host\\a"])("rejects invalid paths (%s)", (path) => {
    expect(() => parseClientMessage({ ...request, path })).toThrow();
  });

  it.each(["sessionId", "requestId"] as const)("requires a bounded, nonblank %s", (key) => {
    for (const value of [undefined, "", " ", "a\n", "x".repeat(129)]) {
      expect(() => parseClientMessage({ ...request, [key]: value })).toThrow();
      expect(serverMessageSchema.safeParse({ ...reply, [key]: value, result: { ok: true } }).success).toBe(false);
    }
  });

  it("accepts an unsequenced success result", () => {
    expect(serverMessageSchema.parse({ ...reply, result: { ok: true } })).toEqual({ ...reply, result: { ok: true } });
  });

  it.each(["invalidPath", "sessionUnavailable", "notFound", "notFile", "permissionDenied", "unsupported", "openFailed"])("accepts recoverable %s results", (code) => {
    expect(serverMessageSchema.safeParse({ ...reply, result: { ok: false, error: { code, message: "Unable to open this file on the server." } } }).success).toBe(true);
  });

  it("rejects malformed or unbounded results", () => {
    for (const result of [undefined, {}, { ok: "true" }, { ok: false }, { ok: false, error: { code: "other", message: "Error" } }, { ok: false, error: { code: "openFailed", message: "" } }, { ok: false, error: { code: "openFailed", message: "x".repeat(513) } }]) {
      expect(serverMessageSchema.safeParse({ ...reply, result }).success).toBe(false);
    }
  });
});
