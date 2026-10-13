/** @vitest-environment jsdom */
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ToolCard } from "../../../../../src/web/chat/tools/ToolCard.js";
import { toolFilePath } from "../../../../../src/web/chat/tools/ToolCard.js";
import { initialChatState, reduceServerMessage } from "../../../../../src/web/app/state/chat-state.js";
import { PROTOCOL_VERSION, type ToolCard as Card } from "../../../../../src/shared/protocol.js";

afterEach(cleanup);
const path = "/Users/user/.pi/agent/skills/daily-briefing/SKILL.md";
const argsText = JSON.stringify({ path });
function show(tool: Card, compact = false) {
  return render(<MantineProvider><ToolCard tool={tool} compact={compact} /></MantineProvider>);
}

it.each(["running", "success", "error"] as const)("shows the compact skill header with %s status and preserves details", async status => {
  const tool: Card = { toolCallId: "read-1", name: "read", status, argsText, outputText: "Skill instructions or read error" };
  const { container } = show(tool);
  const card = screen.getByTestId("tool-card") as HTMLDetailsElement;
  expect(card.open).toBe(false);
  expect(container.querySelector("summary")?.textContent).toContain("[skill]daily-briefing");
  expect(container.querySelector("summary")?.textContent).not.toContain(path);
  expect(card.classList.contains(status)).toBe(true);
  expect(container.querySelector(".tool-running-pulse") !== null).toBe(status === "running");
  expect(screen.queryByText("Failed") !== null).toBe(status === "error");
  card.open = true;
  fireEvent(card, new Event("toggle"));
  expect(screen.getByText(argsText)).toBeTruthy();
  expect(await screen.findByText("Skill instructions or read error")).toBeTruthy();
  expect(tool.name).toBe("read");
});

it("does not classify unfinished paths and updates once arguments are complete", () => {
  const tool: Card = { toolCallId: "read-1", name: "read", status: "running", argsText: `{"path":"${path}` };
  const { container, rerender } = show(tool, true);
  expect(container.querySelector("summary")?.textContent).not.toContain("[skill]");
  expect(screen.getByTestId("tool-subject").textContent).toBe(path);
  rerender(<MantineProvider><ToolCard tool={{ ...tool, argsText }} compact /></MantineProvider>);
  expect(container.querySelector("summary")?.textContent).toContain("[skill]daily-briefing");
});

it("keeps regular reads unchanged and supports the file_path alias in read details", () => {
  const tool: Card = { toolCallId: "read-1", name: "read", status: "success", argsText: '{"path":"README.md"}' };
  const { container, rerender } = show(tool);
  expect(container.querySelector("summary")?.textContent).toBe("readREADME.md");
  const alias = { ...tool, argsText: JSON.stringify({ file_path: path, path: "ignored.txt", offset: 2, limit: 3 }) };
  expect(toolFilePath(alias)).toBe(path);
  rerender(<MantineProvider><ToolCard tool={alias} /></MantineProvider>);
  expect(container.querySelector("summary")?.textContent).toBe("[skill]daily-briefing:2-4");
});

it("renders the same header for a live call, completed call and restored snapshot", () => {
  const tool: Card = { toolCallId: "read-1", name: "read", status: "running", argsText };
  const base = { version: PROTOCOL_VERSION, sessionId: "s", runId: "r" };
  const live = reduceServerMessage(initialChatState, { ...base, type: "toolEvent", sequence: 1, tool });
  const completed = reduceServerMessage(live, { ...base, type: "toolEvent", sequence: 2, tool: { toolCallId: "read-1", name: "read", status: "success", outputText: "Loaded" } });
  const restored = reduceServerMessage(initialChatState, { ...base, type: "snapshot", sequence: 3, throughSequence: 3, projectPath: "/p", messages: completed.messages, isStreaming: false });
  const cardFrom = (state: typeof live) => {
    const message = state.messages[0];
    if (message?.role !== "tool") throw new Error("Expected tool message");
    return message.tool;
  };
  const { container, rerender } = show(cardFrom(live));
  const header = container.querySelector("summary")?.textContent;
  expect(header).toBe("[skill]daily-briefing");
  for (const state of [completed, restored]) {
    rerender(<MantineProvider><ToolCard tool={cardFrom(state)} /></MantineProvider>);
    expect(container.querySelector("summary")?.textContent).toBe(header);
    expect(cardFrom(state)).toMatchObject({ name: "read", toolCallId: "read-1", argsText, outputText: "Loaded", status: "success" });
  }
});
