import { describe, expect, it } from "vitest";
import { redactRuntimeError } from "../../../../src/server/transport/runtime-error-redaction.js";

describe("redactRuntimeError", () => {
  it("keeps provider failure text but redacts credentials, URLs, and local paths", () => {
    expect(redactRuntimeError("exceeded request buffer limit while retrying upstream; api_key=secret123; https://provider.test/v1?token=abc; /Users/alice/private.json"))
      .toBe("exceeded request buffer limit while retrying upstream; api_key=[REDACTED]; [URL] [PATH]");
  });

  it("flattens and bounds multiline error text", () => {
    expect(redactRuntimeError(`failure\n${"x".repeat(500)}`)).toHaveLength(400);
  });
});
