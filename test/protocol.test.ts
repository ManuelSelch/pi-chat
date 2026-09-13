import { describe, expect, it } from "vitest";
import { parseClientMessage, PROTOCOL_VERSION } from "../src/shared/protocol.js";

describe("client protocol", () => {
  it("accepts a non-empty prompt", () => {
    expect(parseClientMessage({ version: PROTOCOL_VERSION, type: "prompt", message: "hello" })).toMatchObject({ type: "prompt" });
  });

  it("rejects an unsupported protocol version", () => {
    expect(() => parseClientMessage({ version: 2, type: "abort" })).toThrow();
  });

  it("rejects an empty prompt", () => {
    expect(() => parseClientMessage({ version: PROTOCOL_VERSION, type: "prompt", message: "  " })).toThrow();
  });
});
