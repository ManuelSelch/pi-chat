import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rssKilobytes, physicalPeakMegabytes } from "../../scripts/server-memory/metrics.mjs";

const mocks = vi.hoisted(() => ({ execFileSync: vi.fn(), accessSync: vi.fn() }));
vi.mock("node:child_process", () => ({ execFileSync: mocks.execFileSync }));
vi.mock("node:fs", () => ({ accessSync: mocks.accessSync, constants: { X_OK: 1 } }));
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });
function platform(name) { vi.stubGlobal("process", { ...process, platform: name }); }

describe("memory metric system commands", () => {
  it.each(["darwin", "linux"])("uses fixed /bin/ps on %s", (name) => {
    platform(name); mocks.execFileSync.mockReturnValue(" 12345\n");
    expect(rssKilobytes(123)).toBe(12345);
    expect(mocks.accessSync).toHaveBeenCalledExactlyOnceWith("/bin/ps", 1);
    expect(mocks.execFileSync).toHaveBeenCalledExactlyOnceWith("/bin/ps", ["-p", "123", "-o", "rss="], { encoding: "utf8" });
  });
  it("rejects unsupported platforms instead of searching PATH", () => {
    platform("win32");
    expect(() => rssKilobytes(123)).toThrow(/Unsupported memory diagnostics platform/);
    expect(mocks.execFileSync).not.toHaveBeenCalled();
  });
  it.each([["K", 1024, 1], ["M", 12.5, 12.5], ["G", 1.5, 1536]])("preserves vmmap's %s unit conversion", (unit, value, expected) => {
    platform("darwin"); mocks.execFileSync.mockReturnValue(`Physical footprint (peak): ${value}${unit}\n`);
    expect(physicalPeakMegabytes(123)).toBe(expected);
    expect(mocks.accessSync).toHaveBeenCalledExactlyOnceWith("/usr/bin/vmmap", 1);
    expect(mocks.execFileSync).toHaveBeenCalledExactlyOnceWith("/usr/bin/vmmap", ["-summary", "123"], { encoding: "utf8" });
  });
  it("does not request vmmap measurements on Linux", () => {
    platform("linux");
    expect(physicalPeakMegabytes(123)).toBeUndefined();
    expect(mocks.accessSync).not.toHaveBeenCalled(); expect(mocks.execFileSync).not.toHaveBeenCalled();
  });
  it("retains the no-measurement result for unrecognized vmmap output", () => {
    platform("darwin"); mocks.execFileSync.mockReturnValue("No footprint available");
    expect(physicalPeakMegabytes(123)).toBeUndefined();
  });
  it.each(["ps", "vmmap"])("reports missing %s without falling back to PATH", (tool) => {
    platform("darwin"); mocks.accessSync.mockImplementation(() => { throw new Error("ENOENT"); });
    expect(() => tool === "ps" ? rssKilobytes(123) : physicalPeakMegabytes(123)).toThrow(/Required system tool is not executable/);
    expect(mocks.execFileSync).not.toHaveBeenCalled();
  });
});
