import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { verifyPluginPackage } from "../../../scripts/verify-plugin-package.mjs";
await verifyPluginPackage();
const { diffViewerPlugin, diffViewerContract } = await import("@manuelselch/pi-plugin-diff-viewer");
assert.equal(diffViewerPlugin.id,diffViewerContract.id);
assert.equal(typeof diffViewerPlugin.host().setup,"function");
assert.equal("web" in diffViewerPlugin,false);
execFileSync(process.execPath,["--conditions=browser","--input-type=module","-e",`
import assert from "node:assert/strict";
import { diffViewerPlugin, diffViewerUI } from "@manuelselch/pi-plugin-diff-viewer";
assert.equal("host" in diffViewerPlugin,false);
assert.equal(diffViewerPlugin.web(),diffViewerUI);
assert.equal(diffViewerUI.contributions[0].placement,"side-panel");
`],{stdio:"pipe"});
console.log("Verified isolated host/web entries and compiled diff-viewer artifacts.");
