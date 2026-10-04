import { expect, it } from "vitest";
import { toolCardFromCall, mergeEntriesById } from "../src/server/runtime/pi/pi-runtime-adapter.js";
import { initialChatState, reduceServerMessage } from "../src/web/app/state/chat-state.js";
import { PROTOCOL_VERSION } from "../src/shared/protocol.js";

it("projects complete content independently of truncated argument JSON", () => {
  const content = "# Title\n" + "a".repeat(5000);
  const call = toolCardFromCall({ id: "w", name: "write", arguments: { path: "a.md", content } });
  expect(call.writeContent).toEqual({ text: content, truncated: false });
  expect(call.argsText!.length).toBeLessThan(content.length);
  expect(toolCardFromCall({ id: "w", name: "write", arguments: { content: "" } }).writeContent?.text).toBe("");
  expect(toolCardFromCall({ id: "w", name: "read", arguments: { content } }).writeContent).toBeUndefined();
  expect(toolCardFromCall({ id: "w", name: "write", arguments: { content: 3 } }).writeContent).toBeUndefined();
});
it("bounds UTF-8 content without splitting Unicode characters", () => {
  const call = toolCardFromCall({ id: "w", name: "write", arguments: { content: "😀".repeat(30000) } });
  expect(call.writeContent?.truncated).toBe(true);
  expect(Buffer.byteLength(call.writeContent!.text)).toBeLessThanOrEqual(102400);
  expect(call.writeContent!.text.endsWith("😀")).toBe(true);
});
it("preserves content through history merges and live completion then snapshot", () => {
  const tool = toolCardFromCall({ id: "w", name: "write", arguments: { content: "# Saved" } });
  const history = mergeEntriesById([{ id: "tool:w", role: "tool", tool }, { id: "tool:w", role: "tool", tool: { toolCallId: "w", name: "write", status: "success" } }]);
  expect(history[0]).toMatchObject({ tool: { writeContent: { text: "# Saved" } } });
  const base = { version: PROTOCOL_VERSION, sessionId: "s", runId: "r" };
  const start = reduceServerMessage(initialChatState, { ...base, type: "toolEvent", sequence: 1, tool });
  const end = reduceServerMessage(start, { ...base, type: "toolEvent", sequence: 2, tool: { toolCallId: "w", name: "write", status: "success" } });
  const snapshot = reduceServerMessage(end, { ...base, type: "snapshot", sequence: 3, throughSequence: 3, projectPath: "/p", messages: history, isStreaming: false });
  expect(end.messages).toEqual(snapshot.messages);
});
