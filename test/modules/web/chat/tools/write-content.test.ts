import { expect, it } from "vitest";
import { initialSessionState as initialChatState, reduceSessionMessage as reduceServerMessage, type ChatMessage, type ToolCard } from "@manuelselch/pi-sdk";
import { coreEvent, snapshotEvent } from "../../../../infra/v2-fixtures.js";

it("preserves projected write content through live completion then snapshot", () => {
  const tool: ToolCard = { toolCallId: "w", name: "write", status: "running", writeContent: { text: "# Saved", truncated: false } };
  const history: ChatMessage[] = [{ id: "tool:w", role: "tool", tool: { ...tool, status: "success" } }];
  const start = reduceServerMessage(initialChatState, coreEvent("tool.updated", { runId: "r", tool }, "s", 1));
  const end = reduceServerMessage(start, coreEvent("tool.updated", { runId: "r", tool: { toolCallId: "w", name: "write", status: "success" } }, "s", 2));
  const snapshot = reduceServerMessage(end, snapshotEvent({ sessionId: "s", throughSequence: 3, projectPath: "/p", messages: history }));
  expect(end.messages).toEqual(snapshot.messages);
});
