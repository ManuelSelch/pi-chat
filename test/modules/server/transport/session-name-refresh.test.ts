import type { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";
import { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import { createSessionEventHandler } from "../../../../src/server/runtime/pi/event-mapping.js";
import { MessageIdentity } from "../../../../src/server/runtime/pi/message-mapping.js";
import { ServerPublisher } from "../../../../src/server/transport/server-publisher.js";

describe("session name refresh", () => {
  it.each(["Generated title", undefined])("projects a Pi name change (%s) without changing run state", (name) => {
    const emit = vi.fn();
    const state = { currentRunId: "running-turn", lastError: "Previous error" };
    const handler = createSessionEventHandler({
      session: {} as AgentSessionRuntime["session"],
      identity: new MessageIdentity(),
      state,
      inFlightTools: new Set(),
      emit,
      clearAbortWatchdog: vi.fn(),
    });

    handler({ type: "session_info_changed", name });

    expect(emit.mock.calls).toEqual([[{ type: "sessionMetadataChanged" }]]);
    expect(state).toEqual({ currentRunId: "running-turn", lastError: "Previous error" });
  });

  it.each([false, true])("refreshes the changed session, tabs and catalogue while streaming=%s", async (isStreaming) => {
    const runtime = new FakeRuntimeAdapter("background-session");
    const snapshot = { ...runtime.snapshot(), sessionName: "Generated title", isStreaming };
    vi.spyOn(runtime, "snapshot").mockReturnValue(snapshot);
    const chat = new ChatApplicationService(runtime, { continueProject: vi.fn(), openSession: vi.fn(), newSession: vi.fn() });
    vi.spyOn(chat, "currentCatalogue").mockResolvedValue({ projects: [] });
    const send = vi.fn();
    const publisher = new ServerPublisher(chat, send);

    publisher.publish("background-session", { type: "sessionMetadataChanged" });

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(3));
    const messages = send.mock.calls.map(([value]) => value);
    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: "session.snapshot", data: expect.objectContaining({ sessionName: "Generated title", runtime: { status: isStreaming ? "running" : "idle" } }) }),
      expect.objectContaining({ event: "session.list.changed", data: expect.objectContaining({ sessions: [expect.objectContaining({ title: "Generated title" })] }) }),
      expect.objectContaining({ event: "project.list.changed" }),
    ]));
    await chat.dispose();
  });
});
