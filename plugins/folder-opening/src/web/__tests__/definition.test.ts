import { expect, test, vi } from "vitest";
import { folderOpeningContract, folderOpeningPlugin, folderOpeningUI } from "../index.js";

vi.mock("../../host/index.js", () => {
  throw new Error("Web entry must not load host code");
});

test("web declaration provides synchronous ID-free UI under the shared identity", () => {
  expect(folderOpeningPlugin.id).toBe("folder-opening");
  expect(folderOpeningPlugin.provides).toEqual([folderOpeningContract]);
  expect(folderOpeningPlugin).not.toHaveProperty("host");

  expect(folderOpeningPlugin.web()).toBe(folderOpeningUI);
  expect(folderOpeningUI).not.toHaveProperty("id");
  expect(folderOpeningUI.commands[0]?.id).toBe("folder-opening.open");
});
