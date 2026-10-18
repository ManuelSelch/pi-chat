import { snapshotEvent, coreEvent } from "../../../../infra/v2-fixtures.js";
/** @vitest-environment jsdom */
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MessageList } from "../../../../../src/web/chat/transcript/MessageList.js";
import { initialSessionState as initialChatState, reduceSessionMessage as reduceServerMessage } from "@manuelselch/pi-sdk";
import { PROTOCOL_VERSION, type ChatMessage } from "../../../../../src/shared/protocol.js";

afterEach(cleanup);
const message: ChatMessage = {
  id: "user-1", role: "user", text: "",
  skill: { name: "daily-briefing", location: "/skills/daily-briefing/SKILL.md", content: "# Briefing instructions\n\nReview the calendar.\n\n<script>unsafe()</script>" },
};
function show(messages: ChatMessage[], compact = false) {
  return render(<MantineProvider><MessageList messages={messages} draft={undefined} compact={compact} /></MantineProvider>);
}

it.each([false, true])("shows only the skill header until expanded (compact=%s)", async compact => {
  const { container } = show([message], compact);
  const card = screen.getByTestId("skill-invocation") as HTMLDetailsElement;
  expect(card.open).toBe(false);
  expect(container.querySelector("summary")?.textContent).toBe("[skill] daily-briefing");
  expect(screen.queryByRole("heading", { name: "Briefing instructions" })).toBeNull();
  expect(container.querySelector(".mantine-Paper-root")).toBeNull();
  expect(container.querySelector(".tool-running-pulse")).toBeNull();
  card.open = true;
  fireEvent(card, new Event("toggle"));
  expect(await screen.findByRole("heading", { name: "Briefing instructions" }, { timeout: 5000 })).toBeTruthy();
  expect(screen.getByText("/skills/daily-briefing/SKILL.md")).toBeTruthy();
  expect(container.querySelector("script")).toBeNull();
  card.open = false;
  fireEvent(card, new Event("toggle"));
  expect(screen.queryByRole("heading", { name: "Briefing instructions" })).toBeNull();
});

it("renders appended task text once in the normal user bubble", async () => {
  const { container } = show([{ ...message, text: "Prepare today's **summary**." }]);
  expect(await screen.findByText("summary")).toBeTruthy();
  expect(container.querySelectorAll(".mantine-Paper-root")).toHaveLength(1);
  expect(container.querySelector(".mantine-Paper-root")?.textContent).toBe("Prepare today's summary.");
  expect(container.querySelectorAll('[data-testid="skill-invocation"]')).toHaveLength(1);
});

it("leaves ordinary user messages and assistant text untouched", async () => {
  const { container } = show([
    { id: "plain", role: "user", text: "/skill:unknown task" },
    { id: "assistant", role: "assistant", text: "Ordinary answer" },
  ]);
  expect(await screen.findByText("/skill:unknown task")).toBeTruthy();
  expect(await screen.findByText("Ordinary answer")).toBeTruthy();
  expect(container.querySelector('[data-testid="skill-invocation"]')).toBeNull();
});

it("preserves one collapsed invocation across live final messages and restored snapshots", () => {
  const base = { version: PROTOCOL_VERSION, sessionId: "s", runId: "r" };
  const live = reduceServerMessage(initialChatState, coreEvent("message.finalized", { message: message, runId: base.runId }, base.sessionId, 1));
  const restored = reduceServerMessage(initialChatState, snapshotEvent({ ...base, throughSequence: 2, projectPath: "/p", messages: [message], sessionId: base.sessionId, runtime: { status: "idle" } }));
  const { container, rerender } = show(live.messages);
  expect(screen.getByTestId("skill-invocation").textContent).toBe("[skill] daily-briefing");
  rerender(<MantineProvider><MessageList messages={restored.messages} draft={undefined} /></MantineProvider>);
  expect(container.querySelectorAll('[data-testid="skill-invocation"]')).toHaveLength(1);
  expect(container.querySelector("summary")?.textContent).toBe("[skill] daily-briefing");
  expect(restored.messages).toEqual(live.messages);
});
