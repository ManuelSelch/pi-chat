import { describe, expect, it } from "vitest";
import { clientMessageSchema, PROTOCOL_VERSION, serverMessageSchema } from "../../../../src/shared/protocol.js";
describe("project mutation protocol", () => {
  it("accepts correlated archive and pin commands without a live session", () => {
    expect(clientMessageSchema.safeParse({ version: PROTOCOL_VERSION, type: "setSessionArchived", path: "/sessions/a.jsonl", archived: true, requestId: "a" }).success).toBe(true);
    expect(clientMessageSchema.safeParse({ version: PROTOCOL_VERSION, type: "pinProject", path: "/work", pinned: true, requestId: "b" }).success).toBe(true);
    expect(clientMessageSchema.safeParse({ version: PROTOCOL_VERSION, type: "pinProject", path: "/work", pinned: true }).success).toBe(false);
    expect(serverMessageSchema.safeParse({ version: PROTOCOL_VERSION, type: "projectMutationResult", requestId: "a", error: "disk full" }).success).toBe(true);
  });
});
