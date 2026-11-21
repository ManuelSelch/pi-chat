import { describe, expect, it } from "vitest";
import { uiPromptSchema } from "../../src/protocol/models.js";
import { promptSchema, serverMessageSchema } from "../../src/protocol/v2.js";

const prompt = { id: "models", kind: "select", title: "Select a model", submission: "immediate", options: ["p/one", "p/two"], modelScope: { scoped: ["p/one"] } };

describe("model prompt scope", () => {
  it("retains model scope through both prompt boundaries and live events", () => {
    expect(uiPromptSchema.parse(prompt)).toEqual(prompt);
    expect(promptSchema.parse(prompt)).toEqual(prompt);
    const event = { version: 2, type: "event", serverInstanceId: "server", sessionId: "session", sequence: 1, event: "prompt.list.changed", data: { prompts: [prompt] } };
    expect(serverMessageSchema.parse(event)).toEqual(event);
  });

  it("rejects scoped references outside the offered catalogue and scope on non-model selection shapes", () => {
    for (const schema of [uiPromptSchema, promptSchema]) {
      expect(schema.safeParse({ ...prompt, modelScope: { scoped: ["p/missing"] } }).success).toBe(false);
      expect(schema.safeParse({ ...prompt, submission: "explicit" }).success).toBe(false);
      expect(schema.safeParse({ ...prompt, kind: "input", submission: undefined }).success).toBe(false);
    }
  });
});
