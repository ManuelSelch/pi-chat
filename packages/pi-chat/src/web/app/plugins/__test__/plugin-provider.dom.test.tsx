// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { WebPlugin, WebPluginHost } from "@manuelselch/pi-sdk/plugins";
import { PluginProvider, usePluginCommands, usePluginOverlays } from "../PluginProvider.js";

const host: WebPluginHost = {
  connected: true, projectPath: "/project", request: vi.fn(), createSession: vi.fn(),
  useOverlayFocus: () => ({ returnFocus: false, onExitTransitionEnd: vi.fn() }),
};
const example: WebPlugin<ReactNode> = {
  id: "example",
  useContributions(current) {
    const [opened, setOpened] = useState(false);
    return {
      commands: [{ id: "example.open", name: "Open example", description: "Example", placements: ["menus", "projects"], disabled: !current.connected, run: () => setOpened(true) }],
      overlay: opened ? <div>Example overlay</div> : null,
      blocking: opened,
    };
  },
};
afterEach(cleanup);

it("collects contributions and keeps plugin state across host updates", () => {
  let currentHost = host;
  const { result, rerender } = renderHook(() => ({ commands: usePluginCommands("menus"), overlays: usePluginOverlays() }), {
    wrapper: ({ children }) => <PluginProvider plugins={[example]} host={currentHost}>{children}</PluginProvider>,
  });

  expect(result.current.commands.map(command => command.id)).toEqual(["example.open"]);
  act(() => result.current.commands[0]!.run());

  expect(result.current.overlays.blocking).toBe(true);
  expect(result.current.overlays.items).toHaveLength(1);
  currentHost = { ...host, connected: false };
  rerender();
  expect(result.current.commands[0]!.disabled).toBe(true);
  expect(result.current.overlays.blocking).toBe(true);
});

it("rechecks current command availability and withdraws unregistered commands", () => {
  let connected = true;
  let plugins = [example];
  const { result, rerender } = renderHook(() => ({ commands: usePluginCommands("menus"), overlays: usePluginOverlays() }), {
    wrapper: ({ children }) => <PluginProvider plugins={plugins} host={{ ...host, connected }}>{children}</PluginProvider>,
  });
  const staleCommand = result.current.commands[0]!;
  connected = false;
  rerender();

  act(() => staleCommand.run());

  expect(result.current.commands[0]!.disabled).toBe(true);
  expect(result.current.overlays.blocking).toBe(false);
  plugins = [];
  rerender();
  act(() => staleCommand.run());
  expect(result.current.commands).toEqual([]);
  expect(result.current.overlays.items).toEqual([]);
});

it("collects multiple plugins and filters command placements", () => {
  const other: WebPlugin<ReactNode> = { id: "other", useContributions: () => ({ commands: [{ id: "other.run", name: "Other", description: "Other", placements: ["projects"], run: vi.fn() }] }) };
  const { result } = renderHook(() => usePluginCommands("menus"), {
    wrapper: ({ children }) => <PluginProvider plugins={[example, other]} host={host}>{children}</PluginProvider>,
  });

  expect(result.current.map(command => command.id)).toEqual(["example.open"]);
});

it("rejects duplicate plugin IDs instead of mounting duplicate state", () => {
  expect(() => renderHook(() => usePluginCommands("menus"), {
    wrapper: ({ children }) => <PluginProvider plugins={[example, example]} host={host}>{children}</PluginProvider>,
  })).toThrow("Duplicate plugin: example");
});
