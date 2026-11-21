import { afterEach, beforeEach, expect, it } from "vitest";
import { PromptPresentationDriver } from "../infra/prompt-presentation-driver.js";

let driver: PromptPresentationDriver;
beforeEach(() => { driver = new PromptPresentationDriver(); });
afterEach(async () => { await driver.dispose(); });

it("preserves scoped presentation through the real Pi extension runner for select and editor", async () => {
  await driver.runQuestionAndReasoning();

  expect(driver.requests).toMatchObject([
    { kind: "select", title: "Check", body: { format: "markdown", text: "**Question**" }, submission: "explicit" },
    { kind: "editor", title: "Explain", body: { format: "plain", text: "Why?" }, submitLabel: "Submit answer" },
  ]);
  expect(new Set(driver.requests.map(request => request.id)).size).toBe(2);
});
