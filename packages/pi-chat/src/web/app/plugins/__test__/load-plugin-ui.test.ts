import { expect, it, vi } from "vitest";
import { loadPluginUIs, type LoadedPluginUI } from "../load-plugin-ui.js";
import type { CommandPlacement, PluginUIPlacement } from "@manuelselch/pi-sdk/plugins";
import { examplePlugin } from "./plugin-fixture.js";

it("loads UI under the declaration identity without activating host logic", async () => {
  const { plugin } = examplePlugin();
  const web = vi.fn(async () => plugin.ui);
  const host = vi.fn(async () => ({ setup: vi.fn() }));

  const loaded = await loadPluginUIs([{ id: plugin.id, web, host }]);

  expect(loaded).toEqual([plugin]);
  expect(web).toHaveBeenCalledOnce();
  expect(host).not.toHaveBeenCalled();
});

it("loads synchronous UI contributions alongside asynchronous ones", async () => {
  const first = examplePlugin("first").plugin;
  const second = examplePlugin("second").plugin;

  const loaded = await loadPluginUIs([
    { id: first.id, web: () => first.ui },
    { id: second.id, web: async () => second.ui },
  ]);

  expect(loaded).toEqual([first, second]);
});

it("omits host-only plugins and retains declaration order", async () => {
  const first = examplePlugin("first").plugin;
  const second = examplePlugin("second").plugin;

  const loaded = await loadPluginUIs([
    { id: first.id, web: async () => first.ui },
    { id: "host-only", host: async () => ({ setup() {} }) },
    { id: second.id, web: async () => second.ui },
  ]);

  expect(loaded).toEqual([first, second]);
});

it("rejects duplicate identities before loading contributions", async () => {
  const { plugin } = examplePlugin();
  const web = vi.fn(async () => plugin.ui);

  await expect(loadPluginUIs([{ id: plugin.id, web }, { id: plugin.id, web }])).rejects.toThrow("Duplicate plugin: example");

  expect(web).not.toHaveBeenCalled();
});

it("propagates UI loading failures rather than silently omitting a plugin", async () => {
  const web = vi.fn(async () => { throw new Error("UI unavailable"); });

  await expect(loadPluginUIs([{ id: "example", web }])).rejects.toThrow("UI unavailable");
});

function loadComposition(plugins: readonly LoadedPluginUI[]) {
  return loadPluginUIs(plugins.map(({ id, ui }) => ({ id, web: () => ui })));
}

it.each(["outside", "duplicate"])("rejects %s command IDs during loading", async kind => {
  const { plugin } = examplePlugin();
  const command = { ...plugin.ui.commands![0]!, id: kind === "outside" ? "other.run" : "example.run" };
  const ui = { ...plugin.ui, commands: kind === "outside" ? [command] : [command, command] };

  await expect(loadComposition([{ id: plugin.id, ui }])).rejects.toThrow(kind === "outside" ? "must use the example namespace" : "Duplicate command");
});

it("rejects command collisions across nested plugin namespaces", async () => {
  const outer = examplePlugin().plugin;
  const nested = examplePlugin("example.nested").plugin;

  await expect(loadComposition([{ ...outer, ui: { ...outer.ui, commands: nested.ui.commands } }, nested])).rejects.toThrow("Duplicate command: example.nested.open");
});

it("rejects unsupported command placements before mounting or binding actions", async () => {
  const { plugin } = examplePlugin();
  const provider = vi.fn();
  const useAction = vi.fn(plugin.ui.commands![0]!.useAction);
  const command = { ...plugin.ui.commands![0]!, useAction, placements: ["menus", "unknown" as CommandPlacement] as const };

  await expect(loadComposition([{ ...plugin, ui: { ...plugin.ui, Provider() { provider(); return null; }, commands: [command] } }])).rejects.toThrow("Unknown command placement: unknown");

  expect(provider).not.toHaveBeenCalled();
  expect(useAction).not.toHaveBeenCalled();
});

it.each(["outside", "duplicate", "unknown placement"])("rejects %s UI contributions during loading", async kind => {
  const { plugin } = examplePlugin();
  const contribution = {
    id: kind === "outside" ? "other.toggle" : "example.toggle",
    placement: (kind === "unknown placement" ? "settings.unknown" : "settings.feature-toggles") as PluginUIPlacement,
    Component: () => null,
  };
  const ui = { ...plugin.ui, contributions: kind === "duplicate" ? [contribution, contribution] : [contribution] };

  await expect(loadComposition([{ ...plugin, ui }])).rejects.toThrow(kind === "outside" ? "must use the example namespace" : kind === "duplicate" ? "Duplicate contribution" : "Unknown UI placement");
});

it("rejects contribution collisions across nested plugin namespaces", async () => {
  const outer = examplePlugin().plugin;
  const nested = examplePlugin("example.nested").plugin;
  const contributions = [{ id: "example.nested.toggle", placement: "settings.feature-toggles" as const, Component: () => null }];

  await expect(loadComposition([outer, nested].map(plugin => ({ ...plugin, ui: { ...plugin.ui, contributions } })))).rejects.toThrow("Duplicate contribution: example.nested.toggle");
});
