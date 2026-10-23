import { describe, expect, it } from "vitest";
import { requestSchema, serverMessageSchema, parseResponse, operationSchemas, snapshotSchema } from "../src/protocol/v2.js";

const request = (method: string, params: object = {}, sessionId?: string) => ({ version: 2, type: "request", requestId: "r1", method, params, ...(sessionId ? { sessionId } : {}) });
export const snapshot = {
  sessionId: "runtime", throughSequence: 0, projectPath: "/project", messages: [],
  runtime: { status: "idle" }, steeringMessages: [],
  settings: { model: "provider/model", availableModels: ["provider/model"], thinkingLevel: "off", availableThinkingLevels: ["off"] },
  commands: [], prompts: [],
};

describe("v2-only contract", () => {
  it("requires the custom v2 envelope and rejects all legacy commands", () => {
    expect(requestSchema.parse(request("session.create"))).toEqual(request("session.create"));
    for (const command of [
      { version: 1, type: "newSession" }, { version: 2, type: "newSession" },
      request("runFeature", { featureId: "model.select", input: { model: "m" } }),
      request("focusTab", {}, "s"), request("openProject", { path: "/p" }),
    ]) expect(requestSchema.safeParse(command).success).toBe(false);
  });

  it("enforces scope, bounded IDs, safe counters, JSON and prompt discrimination", () => {
    expect(requestSchema.safeParse(request("message.send", { message: "hello" })).success).toBe(false);
    expect(requestSchema.parse(request("message.send", { message: "  hello  " }, "s")).params).toEqual({ message: "hello" });
    expect(requestSchema.safeParse(request("server.ping", {}, "app")).success).toBe(false);
    expect(requestSchema.safeParse({ ...request("server.ping"), requestId: "r".repeat(129) }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...snapshot, throughSequence: Number.MAX_SAFE_INTEGER + 1 }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...snapshot, prompts: [{ id: "p", title: "Choose", kind: "select" }] }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...snapshot, messages: [{ id: "n", role: "notice", level: "info", text: "local-only" }] }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...snapshot, presentation: { revision: 0, widgets: [], footer: [], extensions: { buttons: [], badges: [], state: { bad: undefined } } } }).success).toBe(false);
  });

  it("caps wire transcript/tool IDs while Pi adapters normalize oversized source IDs", () => {
    const tooLong = "x".repeat(129);
    expect(snapshotSchema.safeParse({ ...snapshot, messages: [{ id: tooLong, role: "assistant", text: "x" }] }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...snapshot, messages: [{ id: "tool:short", role: "tool", tool: { toolCallId: tooLong, name: "read", status: "success" } }] }).success).toBe(false);
    expect(requestSchema.safeParse({ ...request("server.ping"), requestId: tooLong }).success).toBe(false);
  });

  it("validates responses against the pending method, never a generic untyped result", () => {
    const envelope = { version: 2, type: "response", requestId: "r1", ok: true };
    const response = parseResponse("session.snapshot", { ...envelope, result: snapshot });
    expect(response.ok && response.result).toEqual(snapshot);
    expect(() => parseResponse("session.snapshot", { ...envelope, result: { state: "completed" } })).toThrow();
    expect(() => parseResponse("message.send", { ...envelope, result: { state: "accepted" } })).toThrow();
    expect(parseResponse("message.send", { ...envelope, result: { state: "accepted", operationId: "op" } }).ok).toBe(true);
    expect(parseResponse("session.close", { ...envelope, ok: false, error: { code: "sessionNotFound", message: "Closed" } }).ok).toBe(false);
    expect(serverMessageSchema.safeParse({ ...envelope, ok: false, result: {}, error: { code: "operationFailed", message: "x" } }).success).toBe(false);
  });

  it("uses separate snapshot watermarks, core event sequences and presentation revisions", () => {
    const base = { version: 2, type: "event", serverInstanceId: "process", sessionId: "runtime" };
    expect(serverMessageSchema.safeParse({ ...base, event: "session.snapshot", data: snapshot }).success).toBe(true);
    expect(serverMessageSchema.safeParse({ ...base, event: "message.delta", data: { runId: "run", delta: "hi" } }).success).toBe(false);
    expect(serverMessageSchema.safeParse({ ...base, event: "message.delta", sequence: 1, data: { runId: "run", delta: "hi" } }).success).toBe(true);
    expect(serverMessageSchema.safeParse({ ...base, event: "presentation.changed", data: { revision: 0, widgets: [], footer: [], extensions: { buttons: [], badges: [], state: {} } } }).success).toBe(true);
    expect(serverMessageSchema.safeParse({ ...base, event: "presentation.changed", sequence: 1, data: { revision: 0, widgets: [], footer: [], extensions: { buttons: [], badges: [], state: {} } } }).success).toBe(false);
    expect(serverMessageSchema.safeParse({ ...base, event: "required.unknown", sequence: 1, data: {} }).success).toBe(false);
  });

  it("preserves unknown optional rendering hints without accepting unknown core variants", () => {
    const presentation = { revision: 1,
      widgets: [{ key: "future", lines: ["plain text"], placement: "future.position" }],
      footer: [{ key: "future", text: "hint", align: "future.align", variant: "future.style" }],
      extensions: { buttons: [{ id: "future", actionId: "demo", label: "Demo", slot: "future.slot" }], badges: [{ id: "future", label: "Hint", slot: "future.slot", tone: "future.tone" }], state: {} },
    };
    expect(snapshotSchema.safeParse({ ...snapshot, presentation }).success).toBe(true);
  });

  it("has exactly the approved 23 methods without tab/focus or feature wrappers", () => {
    expect(Object.keys(operationSchemas).sort()).toEqual([
      "server.initialize", "server.ping", "server.restart", "session.create", "session.open", "session.list", "session.snapshot", "session.close", "session.compact", "session.reload", "session.archive",
      "project.list", "project.pin", "project.remove", "message.send", "run.abort", "prompt.answer", "model.select", "thinking.level", "extension.run", "directory.browse", "command.complete", "file.open",
    ].sort());
  });
});
