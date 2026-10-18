import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("ships only v2 wire artifacts and no obsolete implementation output", () => {
  const schema = JSON.parse(readFileSync(new URL(import.meta.resolve("@manuelselch/pi-sdk/protocol/schema/v2/Request.schema.json")), "utf8"));
  const samples = JSON.parse(readFileSync(new URL(import.meta.resolve("@manuelselch/pi-sdk/protocol/fixtures/v2/valid.json")), "utf8"));
  expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema"); expect(samples.operations).toHaveLength(23); expect(samples.events).toHaveLength(17);
  expect(existsSync(new URL("../dist/contract/protocol.js", import.meta.url))).toBe(false); expect(existsSync(new URL("../dist/protocol/schema/v1/", import.meta.url))).toBe(false);
});
