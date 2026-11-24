import assert from "node:assert/strict";
import { test } from "node:test";
import { isUnmappedRuntime } from "../../packages/pi-chat/scripts/report-playwright-coverage.mjs";

test("only known generated unmapped helpers bypass original-source coverage",()=>{
  assert.equal(isUnmappedRuntime("/assets/preload-helper-abc123.js","generated helper"),true);
  assert.equal(isUnmappedRuntime("/assets/rolldown-runtime-abc123.js","generated helper"),true);
  assert.equal(isUnmappedRuntime("/assets/preload-helper-abc123.js","//# sourceMappingURL=helper.js.map"),false);
  assert.equal(isUnmappedRuntime("/assets/index-abc123.js","application code without a map"),false);
  assert.equal(isUnmappedRuntime("/assets/DiffStream-abc123.js","plugin code without a map"),false);
  assert.equal(isUnmappedRuntime("/assets/core-abc123.js",'import{a as b}from"./mapped.js";export{b as c};'),true);
  assert.equal(isUnmappedRuntime("/assets/core-abc123.js",'import{a as b}from"./mapped.js";b();export{b as c};'),false);
  assert.equal(isUnmappedRuntime("/assets/core-abc123.js",'import{a as b}from"./mapped.js";export{b as c};\n//# sourceMappingURL=core.js.map'),false);
});
