import { expect, test } from "vitest";
import plugin from "../../../../src/plugins/file-opening/index.js";
import { fileOpeningContract } from "@manuelselch/pi-sdk/plugins/file-opening";

test("keeps the file-opening host entry inactive and explicitly unimplemented", async () => {
  const entry = await plugin.host();

  expect(plugin.provides).toEqual([fileOpeningContract]);
  expect(() => entry.setup()).toThrow("File-opening host plugin is not implemented.");
});
