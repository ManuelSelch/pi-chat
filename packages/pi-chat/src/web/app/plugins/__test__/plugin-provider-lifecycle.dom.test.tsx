// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { PluginProvider, PluginOverlayOutlet, usePluginCommands, usePluginOverlayOpen } from "../PluginProvider.js";
import { examplePlugin, host } from "./plugin-fixture.js";

let example: ReturnType<typeof examplePlugin>;
beforeEach(() => { example = examplePlugin(); });
afterEach(cleanup);

it("unmounts plugin providers and overlays with ordinary React cleanup", () => {
  const { result, unmount } = renderHook(() => usePluginCommands("menus"), {
    wrapper: ({ children }) => <PluginProvider plugins={[example.plugin]} host={host}>{children}<PluginOverlayOutlet /></PluginProvider>,
  });
  act(() => result.current[0]!.run());
  expect(screen.getByText("example overlay")).toBeTruthy();

  unmount();

  expect(example.dispose).toHaveBeenCalledOnce();
  expect(screen.queryByText("example overlay")).toBeNull();
});

it("keeps outer provider state when an inner plugin is unmounted", () => {
  const inner = examplePlugin("inner");
  let plugins = [example.plugin, inner.plugin];
  const { result, rerender } = renderHook(() => ({ commands: usePluginCommands("menus"), blocking: usePluginOverlayOpen() }), {
    wrapper: ({ children }) => <PluginProvider plugins={plugins} host={host}>{children}</PluginProvider>,
  });
  act(() => result.current.commands[0]!.run());

  plugins = [example.plugin];
  rerender();

  expect(result.current.blocking).toBe(true);
  expect(result.current.commands).toHaveLength(1);
  expect(inner.dispose).toHaveBeenCalledOnce();
});

it("binds one live command under StrictMode probing", () => {
  const { result } = renderHook(() => usePluginCommands("menus"), {
    wrapper: ({ children }) => <StrictMode><PluginProvider plugins={[example.plugin]} host={host}>{children}</PluginProvider></StrictMode>,
  });

  act(() => result.current[0]!.run());

  expect(result.current).toHaveLength(1);
  expect(example.run).toHaveBeenCalledOnce();
});

it("rejects command collisions across nested plugin namespaces", () => {
  const nested = examplePlugin("example.nested");
  const outer = { ...example.plugin, ui: { ...example.plugin.ui, commands: nested.plugin.ui.commands } };

  expect(() => renderHook(() => usePluginCommands("menus"), {
    wrapper: ({ children }) => <PluginProvider plugins={[outer, nested.plugin]} host={host}>{children}</PluginProvider>,
  })).toThrow("Duplicate command: example.nested.open");
});

it.each(["outside", "duplicate"])("rejects %s command IDs", kind => {
  const command = { ...example.plugin.ui.commands[0]!, id: kind === "outside" ? "other.run" : "example.run" };
  const plugin = { ...example.plugin, ui: { ...example.plugin.ui, commands: kind === "outside" ? [command] : [command, command] } };

  expect(() => renderHook(() => usePluginCommands("menus"), {
    wrapper: ({ children }) => <PluginProvider plugins={[plugin]} host={host}>{children}</PluginProvider>,
  })).toThrow(kind === "outside" ? "must use the example namespace" : "Duplicate command");
});
