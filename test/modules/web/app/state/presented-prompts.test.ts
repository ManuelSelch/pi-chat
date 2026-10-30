import { expect, it } from "vitest";
import { initialAppState } from "../../../../../src/web/app/state/app-state.js";
import { createAppReducer } from "./sdk-harness.js";
import { coreEvent, snapshotData, snapshotEvent } from "../../../../infra/v2-fixtures.js";

it("retains presentation through wire validation, SDK snapshots/events and Chat projection", () => {
  const reducer = createAppReducer();
  const prompt = { id: "rich", kind: "select" as const, title: "Short title", options: ["A", "B"], submission: "explicit" as const,
    body: { format: "markdown" as const, text: "**Question**\n\n$$x^2$$" }, submitLabel: "Continue to reasoning", cancelLabel: "Cancel check" };
  let state = reducer.initialize(initialAppState, [snapshotData({ sessionId: "s", prompts: [prompt] })]);
  expect(state.serverInstanceId).toBe("process");
  expect(state.sessions.s?.prompts).toEqual([prompt]);
  const editor = { id: "why", kind: "editor" as const, title: "Why?", body: { format: "plain" as const, text: "Explain" }, submitLabel: "Submit answer", prefill: "Draft" };
  state = reducer.reduce(state, coreEvent("prompt.list.changed", { prompts: [editor] }, "s", 1));
  expect(state.sessions.s?.prompts).toEqual([editor]);
  state = reducer.reduce(state, snapshotEvent({ sessionId: "s", throughSequence: 2, prompts: [prompt] }));
  expect(state.sessions.s?.prompts).toEqual([prompt]);
});
