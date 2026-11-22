import { expect, it, vi } from "vitest";
import { loadPluginUIs } from "../load-plugin-ui.js";
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
