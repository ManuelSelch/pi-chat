import { expect, test, vi } from "vitest";
import { folderOpeningContract, folderOpeningPlugin } from "../index.js";

const entries = vi.hoisted(() => ({
  loadHost: vi.fn(),
  loadUI: vi.fn(),
  host: { setup: vi.fn() },
  ui: {
    Provider: ({ children }: { children: unknown }) => children,
    commands: [],
    Overlay: () => null,
    useOverlayOpen: () => false,
  },
}));

vi.mock("../host/index.js", () => {
  entries.loadHost();
  return { createFolderOpeningHost: () => entries.host };
});
vi.mock("../web/index.js", () => {
  entries.loadUI();
  return { folderOpeningUI: entries.ui };
});

test("one declaration lazily selects host and ID-free UI contributions independently", async () => {
  expect(folderOpeningPlugin.id).toBe("folder-opening");
  expect(folderOpeningPlugin.provides).toEqual([folderOpeningContract]);
  expect(entries.loadHost).not.toHaveBeenCalled();
  expect(entries.loadUI).not.toHaveBeenCalled();

  const host = await folderOpeningPlugin.host();

  expect(host).toBe(entries.host);
  expect(entries.loadHost).toHaveBeenCalledOnce();
  expect(entries.loadUI).not.toHaveBeenCalled();
  expect(entries.host.setup).not.toHaveBeenCalled();

  const ui = await folderOpeningPlugin.web();

  expect(ui).toBe(entries.ui);
  expect(ui).not.toHaveProperty("id");
  expect(entries.loadHost).toHaveBeenCalledOnce();
  expect(entries.loadUI).toHaveBeenCalledOnce();
});
