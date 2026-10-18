import { snapshotEvent, coreEvent } from "../../../../infra/v2-fixtures.js";
import { expect, it } from "vitest";
import { diffRows } from "../../../../../src/web/chat/tools/EditDiff.js";
import { initialSessionState as initialChatState, reduceSessionMessage as reduceServerMessage } from "@manuelselch/pi-sdk";
import { PROTOCOL_VERSION } from "../../../../../src/shared/protocol.js";

it("counts hunk lines without mistaking code for file headers", () => {
  const rows = diffRows({ format: "unified", truncated: false, text: "--- a\n+++ a\n@@ -4,2 +8,2 @@\n---code\n+++code\n same\n" });
  expect(rows[0]?.kind).toBe("header");
  expect(rows[3]).toMatchObject({ kind: "removal", old: 4, text: "--code" });
  expect(rows[4]).toMatchObject({ kind: "addition", next: 8, text: "++code" });
  expect(rows[5]).toMatchObject({ old: 5, next: 9 });
});
it("keeps completed diffs and arguments through a following snapshot", () => {
  const envelope = { version: PROTOCOL_VERSION, sessionId: "s", runId: "r" };
  const running = reduceServerMessage(initialChatState, coreEvent("tool.updated", { tool: { toolCallId: "e", name: "edit", status: "running", argsText: "{}" }, runId: envelope.runId }, envelope.sessionId, 1));
  const editDiff = { format: "pi-display" as const, text: "-1 a\n+1 b", truncated: false };
  const done = reduceServerMessage(running, coreEvent("tool.updated", { tool: { toolCallId: "e", name: "edit", status: "success", editDiff }, runId: envelope.runId }, envelope.sessionId, 2));
  expect(done.messages[0]).toMatchObject({ tool: { argsText: "{}", editDiff } });
  const snapshot = reduceServerMessage(done, snapshotEvent({ ...envelope, throughSequence: 3, projectPath: "/p", messages: done.messages, sessionId: envelope.sessionId, runtime: { status: "idle" } }));
  expect(snapshot.messages).toEqual(done.messages);
});
