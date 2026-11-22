import { expect, test, vi } from "vitest";
import { folderOpeningContract, folderOpeningPlugin } from "../browser.js";

const ui = vi.hoisted(() => ({
  Provider: ({ children }: { children: unknown }) => children,
  commands: [],
  Overlay: () => null,
  useOverlayOpen: () => false,
}));

vi.mock("../web/index.js", () => ({ folderOpeningUI: ui }));
vi.mock("../host/index.js", () => {
  throw new Error("Browser entry must not load Node code");
});

test("browser declaration provides synchronous ID-free UI under the shared identity", () => {
  expect(folderOpeningPlugin.id).toBe("folder-opening");
  expect(folderOpeningPlugin.provides).toEqual([folderOpeningContract]);
  expect(folderOpeningPlugin).not.toHaveProperty("host");

  expect(folderOpeningPlugin.web()).toBe(ui);
  expect(ui).not.toHaveProperty("id");
});
