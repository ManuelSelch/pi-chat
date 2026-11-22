// @vitest-environment jsdom
import { useLayoutEffect } from "react";
import { act, cleanup, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { PluginProvider, PluginOverlayOutlet, usePluginCommands, usePluginOverlayOpen } from "../PluginProvider.js";
import { examplePlugin, host } from "./plugin-fixture.js";

let example: ReturnType<typeof examplePlugin>;
beforeEach(() => { example = examplePlugin(); });
afterEach(cleanup);

it("shares provider state between commands and overlays across host updates", () => {
  let currentHost = host;
  const { result, rerender } = renderHook(() => ({ commands: usePluginCommands("menus"), blocking: usePluginOverlayOpen() }), {
    wrapper: ({ children }) => <PluginProvider plugins={[example.plugin]} host={currentHost}>{children}<PluginOverlayOutlet /></PluginProvider>,
  });

  expect(result.current.commands.map(command => command.id)).toEqual(["example.open"]);
  act(() => result.current.commands[0]!.run());

  expect(result.current.blocking).toBe(true);
  expect(screen.getByText("example overlay")).toBeTruthy();
  currentHost = { ...host, connected: false };
  rerender();
  expect(result.current.commands[0]!.disabled).toBe(true);
  expect(result.current.blocking).toBe(true);
});

it("updates availability through context and removes unregistered UI", () => {
  let connected = true;
  let plugins = [example.plugin];
  const { result, rerender } = renderHook(() => ({ commands: usePluginCommands("menus"), blocking: usePluginOverlayOpen() }), {
    wrapper: ({ children }) => <PluginProvider plugins={plugins} host={{ ...host, connected }}>{children}<PluginOverlayOutlet /></PluginProvider>,
  });
  connected = false;
  rerender();

  act(() => result.current.commands[0]!.run());

  expect(result.current.commands[0]!.disabled).toBe(true);
  expect(example.run).not.toHaveBeenCalled();
  expect(result.current.blocking).toBe(false);
  plugins = [];
  rerender();
  expect(result.current.commands).toEqual([]);
  expect(screen.queryByText("example overlay")).toBeNull();
});

it("collects multiple plugins and filters static command placements", () => {
  const other = examplePlugin("other", ["projects"]);
  const { result } = renderHook(() => ({ menus: usePluginCommands("menus"), projects: usePluginCommands("projects") }), {
    wrapper: ({ children }) => <PluginProvider plugins={[example.plugin, other.plugin]} host={host}>{children}</PluginProvider>,
  });

  expect(result.current.menus.map(command => command.id)).toEqual(["example.open"]);
  expect(result.current.projects.map(command => command.id)).toEqual(["example.open", "other.open"]);
});

it("provides commands on the first commit without publishing them from effects", () => {
  const observed: string[][] = [];
  renderHook(() => {
    const commands = usePluginCommands("menus");
    useLayoutEffect(() => { observed.push(commands.map(command => command.id)); });
  }, {
    wrapper: ({ children }) => <PluginProvider plugins={[example.plugin]} host={host}>{children}</PluginProvider>,
  });

  expect(observed).toEqual([["example.open"]]);
});

it("rejects duplicate plugin IDs instead of mounting duplicate state", () => {
  expect(() => renderHook(() => usePluginCommands("menus"), {
    wrapper: ({ children }) => <PluginProvider plugins={[example.plugin, example.plugin]} host={host}>{children}</PluginProvider>,
  })).toThrow("Duplicate plugin: example");
});
