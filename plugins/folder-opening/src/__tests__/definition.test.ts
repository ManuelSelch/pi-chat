import { expect, test, vi } from "vitest";
import { folderOpeningContract, folderOpeningPlugin } from "../index.js";

const entries = vi.hoisted(() => ({
  host: { setup: vi.fn() },
}));

vi.mock("../host/index.js", () => ({
  createFolderOpeningHost: () => entries.host,
}));
vi.mock("../web/index.js", () => {
  throw new Error("Node entry must not load browser code");
});

test("Node declaration provides a synchronous host loader without activating it", () => {
  expect(folderOpeningPlugin.id).toBe("folder-opening");
  expect(folderOpeningPlugin.provides).toEqual([folderOpeningContract]);
  expect(folderOpeningPlugin).not.toHaveProperty("web");

  const host = folderOpeningPlugin.host();

  expect(host).toBe(entries.host);
  expect(entries.host.setup).not.toHaveBeenCalled();
});
