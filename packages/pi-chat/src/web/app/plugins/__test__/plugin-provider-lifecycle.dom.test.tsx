// @vitest-environment jsdom
import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { WebPlugin, WebPluginHost } from "@manuelselch/pi-sdk/plugins";
import { PluginProvider, usePluginCommands, usePluginOverlays } from "../PluginProvider.js";

const host: WebPluginHost = {
  connected: true, request: vi.fn(), createSession: vi.fn(),
  useOverlayFocus: () => ({ returnFocus: false, onExitTransitionEnd: vi.fn() }),
};
afterEach(cleanup);

it("releases plugin effects and withdraws stale command handlers on unmount", () => {
  const dispose = vi.fn();
  const run = vi.fn();
  const plugin: WebPlugin<ReactNode> = { id: "example", useContributions() {
    useEffect(() => dispose, []);
    return { commands: [{ id: "example.run", name: "Run", description: "", placements: ["menus"], run }] };
  } };
  const { result, unmount } = renderHook(() => usePluginCommands("menus"), {
    wrapper: ({ children }) => <PluginProvider plugins={[plugin]} host={host}>{children}</PluginProvider>,
  });
  const command = result.current[0]!;

  unmount();
  command.run();

  expect(dispose).toHaveBeenCalledOnce();
  expect(run).not.toHaveBeenCalled();
});

it("preserves remaining plugin state when another plugin is unregistered", () => {
  const first: WebPlugin<ReactNode> = { id: "first", useContributions: () => ({ commands: [] }) };
  const second: WebPlugin<ReactNode> = { id: "second", useContributions() {
    const [opened, setOpened] = useState(false);
    return { blocking: opened, commands: [{ id: "second.open", name: "Open", description: "", placements: ["menus"], run: () => setOpened(true) }] };
  } };
  let plugins = [first, second];
  const { result, rerender } = renderHook(() => ({ commands: usePluginCommands("menus"), overlays: usePluginOverlays() }), {
    wrapper: ({ children }) => <PluginProvider plugins={plugins} host={host}>{children}</PluginProvider>,
  });
  act(() => result.current.commands[0]!.run());

  plugins = [second];
  rerender();

  expect(result.current.overlays.blocking).toBe(true);
  expect(result.current.commands).toHaveLength(1);
});

it("registers one live command under StrictMode probing", () => {
  const run = vi.fn();
  const plugin: WebPlugin<ReactNode> = { id: "example", useContributions: () => ({
    commands: [{ id: "example.run", name: "Run", description: "", placements: ["menus"], run }],
  }) };
  const { result } = renderHook(() => usePluginCommands("menus"), {
    wrapper: ({ children }) => <StrictMode><PluginProvider plugins={[plugin]} host={host}>{children}</PluginProvider></StrictMode>,
  });

  act(() => result.current[0]!.run());

  expect(result.current).toHaveLength(1);
  expect(run).toHaveBeenCalledOnce();
});

it("rejects command collisions across nested plugin namespaces", () => {
  const command = { id: "example.nested.run", name: "Run", description: "", placements: ["menus"] as const, run: vi.fn() };
  const plugins = ["example", "example.nested"].map(id => ({ id, useContributions: () => ({ commands: [command] }) }));

  expect(() => renderHook(() => usePluginCommands("menus"), {
    wrapper: ({ children }) => <PluginProvider plugins={plugins} host={host}>{children}</PluginProvider>,
  })).toThrow("Duplicate command: example.nested.run");
});

it.each(["outside", "duplicate"])("rejects %s command IDs", kind => {
  const command = { id: kind === "outside" ? "other.run" : "example.run", name: "Run", description: "", placements: ["menus"] as const, run: vi.fn() };
  const plugin: WebPlugin<ReactNode> = { id: "example", useContributions: () => ({ commands: kind === "outside" ? [command] : [command, command] }) };

  expect(() => renderHook(() => usePluginCommands("menus"), {
    wrapper: ({ children }) => <PluginProvider plugins={[plugin]} host={host}>{children}</PluginProvider>,
  })).toThrow(kind === "outside" ? "must use the example namespace" : "Duplicate command");
});
