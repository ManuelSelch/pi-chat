import { expect, it } from "vitest";
import { diffRows } from "../src/web/chat/tools/EditDiff.js";
import { initialChatState, reduceServerMessage } from "../src/web/app/state/chat-state.js";
import { PROTOCOL_VERSION } from "../src/shared/protocol.js";

it("counts hunk lines without mistaking code for file headers", () => {
  const rows = diffRows({ format: "unified", truncated: false, text: "--- a\n+++ a\n@@ -4,2 +8,2 @@\n---code\n+++code\n same\n" });
  expect(rows[0]?.kind).toBe("header");
  expect(rows[3]).toMatchObject({ kind: "removal", old: 4, text: "--code" });
  expect(rows[4]).toMatchObject({ kind: "addition", next: 8, text: "++code" });
  expect(rows[5]).toMatchObject({ old: 5, next: 9 });
});
it("keeps completed diffs and arguments through a following snapshot", () => {
  const envelope = { version: PROTOCOL_VERSION, sessionId: "s", runId: "r" };
  const running = reduceServerMessage(initialChatState, { ...envelope, type: "toolEvent", sequence: 1, tool: { toolCallId: "e", name: "edit", status: "running", argsText: "{}" } });
  const editDiff = { format: "pi-display" as const, text: "-1 a\n+1 b", truncated: false };
  const done = reduceServerMessage(running, { ...envelope, type: "toolEvent", sequence: 2, tool: { toolCallId: "e", name: "edit", status: "success", editDiff } });
  expect(done.messages[0]).toMatchObject({ tool: { argsText: "{}", editDiff } });
  const snapshot = reduceServerMessage(done, { ...envelope, type: "snapshot", sequence: 3, throughSequence: 3, projectPath: "/p", messages: done.messages, isStreaming: false });
  expect(snapshot.messages).toEqual(done.messages);
});
