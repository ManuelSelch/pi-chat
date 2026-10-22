import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { formatProjectDisplayPath, formatProjectName } from "../../../../src/server/projects/project-display.js";

describe("project name normalization", () => {
  it.each([
    ["/work/pi-chat///", "pi-chat"],
    ["/work/project/frontend///", "project/frontend"],
    ["C:\\work\\project\\backend\\\\", "project/backend"],
    ["\\\\host\\share\\project\\", "project"],
    ["/work//project", "project"],
    ["/work/../project", "project"],
    ["", ""],
    ["/", ""],
    ["////", ""],
    ["C:\\", "C:"],
  ])("preserves the name for %j", (path, expected) => {
    expect(formatProjectName(path)).toBe(expected);
  });
});

describe("project display path normalization", () => {
  it.each([
    ["/Users/me/project///", "/Users/me///", "~/project"],
    ["/Users/me///", "/Users/me/", "~"],
    ["/Users/me-other/project/", "/Users/me", "/Users/me-other/project"],
    ["/users/ME/project/", "/Users/me", "/users/ME/project"],
    ["c:\\USERS\\me\\Project\\", "C:\\Users\\Me\\", "~/Project"],
    ["\\\\host\\share\\project\\", "\\\\host\\share\\", "~/project"],
    ["/outside//project///", "/Users/me", "/outside//project"],
    ["/work/../project/", "/Users/me", "/work/../project"],
    ["", "/Users/me", ""],
    ["/", "/Users/me", ""],
    ["////", "/", "~"],
    ["C:\\", "/Users/me", "C:"],
    // Preserve the empty-home early return: no separator normalization.
    ["C:\\work\\project\\", "", "C:\\work\\project\\"],
  ])("preserves display behavior for %j relative to %j", (path, home, expected) => {
    expect(formatProjectDisplayPath(path, home)).toBe(expected);
  });

  it("handles long slash runs without blocking the test worker", () => {
    // A generous process safety deadline, not a microbenchmark or timing ratio.
    // The old regex retries each slash start; kill it rather than hang Vitest.
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      import { formatProjectName, formatProjectDisplayPath } from './src/server/projects/project-display.ts';
      const slashes = '/'.repeat(200_000);
      const path = slashes + 'project';
      assert.equal(formatProjectName(path), 'project');
      assert.equal(formatProjectDisplayPath(path, '/home'), path);
      assert.equal(formatProjectDisplayPath('/outside/project', slashes + 'home'), '/outside/project');
      assert.equal(formatProjectName('/work/project' + slashes), 'project');
      assert.equal(formatProjectDisplayPath('/home/project' + slashes, '/home' + slashes), '~/project');
      assert.equal(formatProjectName(slashes), '');
    `], { encoding: "utf8", timeout: 10_000 });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
  }, 15_000);
});
