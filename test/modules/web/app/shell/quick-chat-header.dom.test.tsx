// @vitest-environment jsdom
import { AppShell, MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { initialAppState, type AppState } from "../../../../../src/web/app/state/app-state.js";
import { initialChatState } from "../../../../../src/web/app/state/chat-state.js";
import { HeaderContainer } from "../../../../../src/web/app/shell/HeaderContainer.js";

const chat = {
  app: initialAppState as AppState, state: initialChatState, inboxEnabled: true,
  inbox: { pending: false },
};
vi.mock("../../../../../src/web/app/AppControllerContext.js", () => ({ useAppController: () => chat }));
vi.mock("../../../../../src/web/app/overlays/OverlayController.js", () => ({ useOverlays: () => ({ state: { projects: false } }) }));
afterEach(cleanup);

it.each([
  { catalogueName: "Quick Chats", quickChats: true, expected: "Quick Chat" },
  { catalogueName: "Personal folder", quickChats: false, expected: "manuelselch" },
  { catalogueName: undefined, quickChats: false, expected: "manuelselch" },
])("shows $expected in the header (catalogue=$catalogueName, quickChats=$quickChats)", ({ catalogueName, quickChats, expected }) => {
  chat.app = {
    ...initialAppState, connection: "open", tabsKnown: true, activeSessionId: "quick",
    tabs: [{ sessionId: "quick", title: "Conversation", projectPath: "/home/manuelselch", projectName: "manuelselch", status: "idle" }],
    catalogue: { projects: catalogueName ? [{
      path: "/home/manuelselch", displayPath: "~", name: catalogueName, quickChats,
      exists: true, modified: 0, sessionCount: 0, sessions: [],
    }] : [] },
  };

  render(<MantineProvider><AppShell><HeaderContainer /></AppShell></MantineProvider>);

  expect(screen.getByText(expected, { exact: true })).toBeTruthy();
  if (quickChats) expect(screen.queryByText("manuelselch", { exact: true })).toBeNull();
  expect(screen.getByText("Conversation", { exact: true })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sessions" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "New session" })).toBeTruthy();
});
