// @vitest-environment jsdom
import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { act, cleanup, fireEvent, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { PluginProvider, PluginOverlayOutlet, PluginUIOutlet, usePluginCommands, usePluginOverlayOpen } from "../PluginProvider.js";
import { examplePlugin, host } from "./plugin-fixture.js";

import { MantineProvider } from "@mantine/core";
import type { PluginUI } from "@manuelselch/pi-sdk/plugins";

const SettingsState = createContext({ count: 0, increment: () => {} });
const settingsUI: PluginUI<ReactNode> = {
  Provider({ children }) {
    const [count, setCount] = useState(0);
    return <SettingsState.Provider value={{ count, increment: () => setCount(value => value + 1) }}>{children}</SettingsState.Provider>;
  },
  contributions: [{ id: "settings.example", placement: "settings.feature-toggles", Component() {
    const state = useContext(SettingsState);
    return <button onClick={state.increment}>Setting {state.count}</button>;
  } }],
};

let example: ReturnType<typeof examplePlugin>;
beforeEach(() => { example = examplePlugin(); });
afterEach(cleanup);

it("renders settings-only contributions beneath their provider and removes them with the plugin", () => {
  let plugins = [{ id: "settings", ui: settingsUI }];
  const { result, rerender } = renderHook(() => ({ commands: usePluginCommands("menus"), blocking: usePluginOverlayOpen() }), {
    wrapper: ({ children }) => <MantineProvider><PluginProvider plugins={plugins} host={host}>{children}<PluginUIOutlet placement="settings.feature-toggles" /><PluginOverlayOutlet /></PluginProvider></MantineProvider>,
  });

  fireEvent.click(screen.getByRole("button", { name: "Setting 0" }));

  expect(screen.getByRole("button", { name: "Setting 1" })).toBeTruthy();
  expect(result.current).toEqual({ commands: [], blocking: false });
  plugins = [];
  rerender();
  expect(screen.queryByRole("button", { name: "Setting 1" })).toBeNull();
});

it.each(["outside", "duplicate", "unknown placement"])("rejects %s UI contributions", kind => {
  const contribution = { ...settingsUI.contributions![0]!, ...(kind === "outside" ? { id: "other.toggle" } : {}), ...(kind === "unknown placement" ? { placement: "settings.unknown" as "settings.feature-toggles" } : {}) };
  const ui = { ...settingsUI, contributions: kind === "duplicate" ? [contribution, contribution] : [contribution] };

  expect(() => renderHook(() => usePluginCommands("menus"), {
    wrapper: ({ children }) => <PluginProvider plugins={[{ id: "settings", ui }]} host={host}>{children}</PluginProvider>,
  })).toThrow(kind === "outside" ? "must use the settings namespace" : kind === "duplicate" ? "Duplicate contribution" : "Unknown UI placement");
});

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
