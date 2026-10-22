import { describe, expect, it } from "vitest";
import { isAppSource, validateLcov, validateNodeData, recoverNodeEntries } from "../../../../scripts/report-playwright-coverage.mjs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

describe("E2E coverage scope", () => {
  it("keeps only original root application sources", () => {
    for (const path of ["src/server/bootstrap/server.ts", "src/web/App.tsx", "src/shared/files.ts"]) expect(isAppSource(path)).toBe(true);
    for (const path of ["packages/pi-sdk/typescript/src/client.ts", "node_modules/lib/src/a.ts", "test/a.ts", "dist/web/a.js", "src/a.d.ts", "src/../packages/a.ts", "/other/src/a.ts"]) expect(isAppSource(path)).toBe(false);
  });
  it("rejects backend coverage without a usable transform map", () => {
    const url = pathToFileURL(resolve("src/server/bootstrap/server.ts")).href;
    const result = [{ url, functions: [] }];
    expect(() => validateNodeData({ result })).toThrow(/map/i);
    expect(validateNodeData({ result, "source-map-cache": { [url]: { data: { version: 3, sources: [url], sourcesContent: ["source"], mappings: "AAAA" }, lineLengths: [6] } } })).toBe(1);
  });
  it("refuses missing or mismatched transformed sources instead of approximating coverage", () => {
    const url = pathToFileURL(resolve("src/server/bootstrap/server.ts")).href;
    const data = { result: [{ url, functions: [] }], "source-map-cache": { [url]: {
      data: { version: 3, sources: [url], sourcesContent: ["source"], mappings: "AAAA" }, lineLengths: [6],
    } } };
    expect(() => recoverNodeEntries(data, new Map())).toThrow(/transformed source/i);
  });
  it("recovers exact executed code and retains its original source map", () => {
    const url = pathToFileURL(resolve("src/server/bootstrap/server.ts")).href;
    const source = "const answer = 42;";
    const map = { version: 3, sources: [url], sourcesContent: ["const answer: number = 42;"], mappings: "AAAA" };
    const key = createHash("sha256").update(JSON.stringify([map.mappings, map.sourcesContent])).digest("hex");
    const data = { result: [{ url, functions: [] }], "source-map-cache": { [url]: { data: map, lineLengths: [source.length] } } };
    expect(recoverNodeEntries(data, new Map([[key, source]]))).toEqual([{ url, functions: [], source, sourceMap: map }]);
    expect(() => recoverNodeEntries(data, new Map([[key, source + "changed"]]))).toThrow(/mismatched/i);
  });
  it("requires executed frontend and backend source records", () => {
    const record = (path, hits = 1) => `SF:${path}\nDA:1,${hits}\nend_of_record\n`;
    expect(() => validateLcov(record("src/web/App.tsx"))).toThrow(/backend/i);
    expect(() => validateLcov(record("src/server/a.ts"))).toThrow(/browser/i);
    expect(() => validateLcov(record("src/web/App.tsx", 0) + record("src/server/a.ts"))).toThrow(/browser/i);
    expect(() => validateLcov(record("src/web/App.tsx") + record("src/server/a.ts") + record("packages/pi-sdk/typescript/src/client.ts"))).toThrow(/scope/i);
    expect(() => validateLcov(record("src/web/App.tsx") + record("src/server/a.ts"))).not.toThrow();
  });
});
