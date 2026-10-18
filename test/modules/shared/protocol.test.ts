import { describe, expect, it } from "vitest";
import { requestSchema, PROTOCOL_VERSION, eventSchema, parseResponse, slashCommandSchema, messageSchema, promptSchema } from "../../../src/shared/protocol.js";
import { snapshotEvent, coreEvent, snapshotData, presentationEvent } from "../../infra/v2-fixtures.js";
describe("v2 contract", () => {
  const command = (method: string, params: object, sessionId?: string) => ({ version: PROTOCOL_VERSION, type: "request", requestId: "r", method, params, ...(sessionId ? { sessionId } : {}) });
  it("trims nonempty prompt params and rejects v1, blank input and wrapped features", () => {
    expect(requestSchema.parse(command("message.send", { message: " hello " }, "s"))).toMatchObject({ params: { message: "hello" } });
    expect(() => requestSchema.parse({ ...command("message.send", { message: "hi" }, "s"), version: 1 })).toThrow();
    expect(() => requestSchema.parse(command("message.send", { message: " " }, "s"))).toThrow();
    expect(() => requestSchema.parse(command("runFeature", { featureId: "model.select", input: { model: "p/m" } }, "s"))).toThrow();
  });
  it("carries native feature parameters directly, not featureId wrappers", () => {
    for (const [method, params] of [["model.select", { model: "p/m" }], ["thinking.level", { level: "high" }], ["session.compact", {}], ["session.reload", {}]] as const) expect(requestSchema.parse(command(method, params, "s"))).toMatchObject({ method, params });
    expect(() => requestSchema.parse(command("session.rename", { name: "Study" }, "s"))).toThrow();
  });
  it("preserves slash command metadata through snapshots", () => {
    const commands = [{ name: "deploy", description: "Deploy", argumentHint: "target", source: "extension" as const }];
    expect(slashCommandSchema.parse(commands[0])).toEqual(commands[0]); expect(eventSchema.parse(snapshotEvent({ sessionId: "s", commands }))).toMatchObject({ data: { commands } });
  });
  it("keeps archiving correlated and independent of an open runtime", () => {
    expect(requestSchema.parse(command("session.archive", { path: "/saved.jsonl", archived: true }))).toMatchObject({ method: "session.archive" });
    expect(() => requestSchema.parse(command("session.delete", { path: "/saved.jsonl" }))).toThrow();
  });
  it("carries streamed reasoning and optional reasoning in finalized history", () => {
    expect(eventSchema.parse(coreEvent("message.thinking.delta", { runId: "r", delta: "hm" }, "s", 1))).toMatchObject({ data: { delta: "hm" } });
    for (const thinking of [undefined, "reason"]) expect(messageSchema.parse({ id: "a", role: "assistant", text: "answer", thinking })).toMatchObject({ role: "assistant" });
  });
  it("carries custom extension messages but never authoritative browser notices", () => {
    expect(snapshotData({ sessionId: "s", messages: [{ id: "c", role: "custom", customType: "demo", text: "output" }] }).messages[0]).toMatchObject({ role: "custom" });
    expect(messageSchema.safeParse({ id: "notice", role: "notice", level: "info", text: "local only" }).success).toBe(false);
  });
  it("validates required prompt variants while preserving optional fields", () => {
    expect(promptSchema.parse({ id: "p", kind: "confirm", title: "Run?", message: "Details" })).toMatchObject({ kind: "confirm" });
    expect(promptSchema.safeParse({ id: "p", kind: "select", title: "Pick" }).success).toBe(false);
    expect(promptSchema.safeParse({ id: "p", kind: "future", title: "Pick" }).success).toBe(false);
  });
  it("accepts unknown optional widget placements without weakening required lines", () => {
    expect(eventSchema.parse(presentationEvent({ widgets: [{ key: "w", placement: "future", lines: ["text"] }] }, "s", 1))).toMatchObject({ event: "presentation.changed" });
    expect(eventSchema.safeParse({ ...presentationEvent({}, "s", 1), data: { revision: 1, widgets: [{ key: "w", placement: "aboveEditor", lines: [1] }], footer: [], extensions: { buttons: [], badges: [], state: {} } } }).success).toBe(false);
  });
  it("validates successes using the pending method and rejects old uncorrelated reply families", () => {
    expect(parseResponse("server.ping", { version: 2, type: "response", requestId: "r", ok: true, result: { state: "completed" } })).toMatchObject({ ok: true });
    expect(() => parseResponse("session.open", { version: 2, type: "response", requestId: "r", ok: true, result: { state: "completed" } })).toThrow();
  });
});
