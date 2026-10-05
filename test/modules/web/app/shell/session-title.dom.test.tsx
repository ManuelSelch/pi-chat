// @vitest-environment jsdom
import type { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { AppShell, MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PROTOCOL_VERSION, serverMessageSchema } from "../../../../../src/shared/protocol.js";
import { projectSnapshot } from "../../../../../src/server/runtime/pi/snapshot.js";
import { initialAppState } from "../../../../../src/web/app/state/app-state.js";
import { initialChatState, reduceServerMessage } from "../../../../../src/web/app/state/chat-state.js";
import { HeaderContainer } from "../../../../../src/web/app/shell/HeaderContainer.js";

const chat = { app: { ...initialAppState }, state: initialChatState };
vi.mock("../../../../../src/web/app/AppControllerContext.js", () => ({ useAppController: () => chat }));
vi.mock("../../../../../src/web/app/overlays/OverlayController.js", () => ({ useOverlays: () => ({ open: vi.fn() }) }));
afterEach(cleanup);

function snapshot(name: string | undefined, sequence: number, isStreaming = false) {
  const session = {
    sessionId: "s1", sessionName: name, isIdle: !isStreaming, thinkingLevel: "off",
    supportsThinking: () => false, getAvailableThinkingLevels: () => ["off"],
  } as unknown as AgentSessionRuntime["session"];
  const message = serverMessageSchema.parse({
    version: PROTOCOL_VERSION, type: "snapshot", sequence, throughSequence: sequence,
    ...projectSnapshot({ session, cwd: "/project", messages: [], inFlightTools: new Set(), models: [], commands: [], prompts: [], widgets: [], statuses: [] }),
  });
  if (message.type !== "snapshot") throw new Error("Expected snapshot");
  chat.state = reduceServerMessage(chat.state, message);
}

function header() {
  return <MantineProvider><AppShell><HeaderContainer /></AppShell></MantineProvider>;
}

it("shows Pi's session title, refreshes it while running, and clears it on a later snapshot", () => {
  chat.app = { ...initialAppState, tabsKnown: false };
  chat.state = initialChatState;
  snapshot("Original title", 0);
  expect(chat.state).toHaveProperty("sessionName", "Original title");
  expect(chat.state.actions.features.map((feature) => feature.id)).not.toContain("session.rename");
  const view = render(header());
  expect(screen.getByTitle("Original title").textContent).toBe("Original title");
  snapshot("Generated title", 1, true);
  view.rerender(header());
  expect(screen.getByTitle("Generated title").textContent).toBe("Generated title");
  expect(screen.queryByTitle("Original title")).toBeNull();
  expect(screen.getByTestId("status").textContent).toBe("running");
  snapshot(undefined, 2);
  view.rerender(header());
  expect(screen.getByTitle("New session").textContent).toBe("New session");
  expect(screen.queryByTitle("Generated title")).toBeNull();
});
