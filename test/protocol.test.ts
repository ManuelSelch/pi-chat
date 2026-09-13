import { describe, expect, it } from "vitest";
import { parseClientMessage, PROTOCOL_VERSION } from "../src/shared/protocol.js";

describe("client protocol", () => {
  it("accepts a non-empty prompt", () => {
    expect(parseClientMessage({ version: PROTOCOL_VERSION, sessionId: "s1", type: "prompt", message: "hello" })).toMatchObject({ type: "prompt" });
  });

  it("rejects an unsupported protocol version", () => {
    expect(() => parseClientMessage({ version: 2, type: "abort" })).toThrow();
  });

  it("rejects an empty prompt", () => {
    expect(() => parseClientMessage({ version: PROTOCOL_VERSION, sessionId: "s1", type: "prompt", message: "  " })).toThrow();
  });

  it("accepts native feature actions", () => {
    expect(parseClientMessage({ version: PROTOCOL_VERSION, sessionId: "s1", type: "runFeature", featureId: "session.rename", input: { name: "Study" } })).toMatchObject({
      type: "runFeature",
      featureId: "session.rename",
      input: { name: "Study" },
    });
    expect(parseClientMessage({ version: PROTOCOL_VERSION, sessionId: "s1", type: "runFeature", featureId: "thinking.level", input: { level: "high" } })).toMatchObject({
      type: "runFeature",
      featureId: "thinking.level",
      input: { level: "high" },
    });
  });
});

describe("native built-in features", () => {
  it("accepts a model switch and a compact request", () => {
    expect(parseClientMessage({
      version: PROTOCOL_VERSION,
      sessionId: "session",
      type: "runFeature",
      featureId: "model.select",
      input: { model: "doppelclaude/claude-opus-5" },
    })).toMatchObject({ featureId: "model.select" });

    expect(parseClientMessage({
      version: PROTOCOL_VERSION,
      sessionId: "session",
      type: "runFeature",
      featureId: "session.compact",
      input: {},
    })).toMatchObject({ featureId: "session.compact" });
  });

  it("rejects an empty model id", () => {
    expect(() => parseClientMessage({
      version: PROTOCOL_VERSION,
      sessionId: "session",
      type: "runFeature",
      featureId: "model.select",
      input: { model: "" },
    })).toThrow();
  });
});
