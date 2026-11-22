import { expect, test, vi } from "vitest";
import { folderOpeningContract, folderOpeningPlugin } from "../index.js";

const construct = vi.hoisted(() => vi.fn());

vi.mock("../directory-browser-service.js", () => ({
  DirectoryBrowserService: class {
    constructor() { construct(); }
    browse = vi.fn();
  },
  DirectoryOperationError: class extends Error {},
}));
vi.mock("../../web/index.js", () => {
  throw new Error("Host entry must not load browser code");
});

test("host declaration provides a synchronous loader without activating it", () => {
  expect(folderOpeningPlugin.id).toBe("folder-opening");
  expect(folderOpeningPlugin.provides).toEqual([folderOpeningContract]);
  expect(folderOpeningPlugin).not.toHaveProperty("web");
  expect(construct).not.toHaveBeenCalled();

  const host = folderOpeningPlugin.host();

  expect(typeof host.setup).toBe("function");
  expect(construct).toHaveBeenCalledOnce();
});
