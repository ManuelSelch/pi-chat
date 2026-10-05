import type { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import type { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
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
    const snapshot = { sessionId: "background-session", sessionName: "Generated title", isStreaming };
    const tabs = [{ sessionId: "background-session", title: "Generated title" }];
    const catalogue = { projects: [{ sessions: [{ title: "Generated title" }] }] };
    const chat = {
      snapshot: vi.fn().mockResolvedValue(snapshot),
      tabs: vi.fn().mockReturnValue(tabs),
      activeSessionId: vi.fn().mockReturnValue("foreground-session"),
      currentCatalogue: vi.fn().mockResolvedValue(catalogue),
      appFeatures: vi.fn().mockReturnValue([]),
    };
    const send = vi.fn();
    const socket = { readyState: WebSocket.OPEN, send } as unknown as WebSocket;
    const publisher = new ServerPublisher(chat as unknown as ChatApplicationService, () => socket);

    publisher.publish("background-session", { type: "sessionMetadataChanged" });

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(3));
    const messages = send.mock.calls.map(([value]) => JSON.parse(value));
    expect(chat.snapshot).toHaveBeenCalledWith("background-session");
    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "snapshot", sessionId: "background-session", sessionName: "Generated title", isStreaming }),
      expect.objectContaining({ type: "tabs", tabs, activeSessionId: "foreground-session" }),
      expect.objectContaining({ type: "catalogue", catalogue }),
    ]));
    expect(messages.some((message) => message.type === "sessionMetadataChanged")).toBe(false);
  });
});
