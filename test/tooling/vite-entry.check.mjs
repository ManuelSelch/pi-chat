import assert from "node:assert/strict";
import test from "node:test";
import { resolveConfig } from "vite";

test("development dependency scanning excludes independent mockups", async () => {
  const config = await resolveConfig({}, "serve");

  assert.deepEqual(config.optimizeDeps.entries, ["index.html"]);
});
