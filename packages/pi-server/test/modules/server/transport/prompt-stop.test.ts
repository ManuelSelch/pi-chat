import { expect, it, vi } from "vitest";
import type { ChatApplicationService } from "../../../../src/application/chat-application-service.js";
import type { ServerPublisher } from "../../../../src/transport/server-publisher.js";
import { executeOperation } from "../../../../src/transport/command-handler.js";

it.each([
  { isStreaming: false, pending: false, accepted: false },
  { isStreaming: false, pending: true, accepted: true },
  { isStreaming: true, pending: false, accepted: true },
])("Stop admits work for an active turn or a pending dialog (%j)", async ({ isStreaming, pending, accepted }) => {
  const abort = vi.fn(async () => {});
  const chat = { captureSnapshot: () => ({ isStreaming, prompts: pending ? [{ id: "question" }] : [] }), abort, openSessionIds: () => [] } as unknown as ChatApplicationService;
  const publisher = { rawId: () => "runtime", inventoryChanged() {}, async refreshProjects() {} } as unknown as ServerPublisher;
  const execution = await executeOperation({ version: 2, type: "request", requestId: "stop", method: "run.abort", sessionId: "wire-runtime", params: {} }, chat, publisher);
  expect(execution.kind).toBe(accepted ? "accepted" : "completed");
  expect(abort).not.toHaveBeenCalled();
  if (execution.kind === "accepted") {
    await execution.run();
    expect(abort).toHaveBeenCalledExactlyOnceWith("runtime");
  }
});
