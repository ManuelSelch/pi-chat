import { describe, expect, it, vi } from "vitest";
import { build } from "../extension/pi-chat.js";

/** Stands in for pi.exec, whose result field is `code` — never `exitCode`. */
function exec(result: { code: number; stdout?: string; stderr?: string }) {
  return { exec: vi.fn(async () => ({ stdout: "", stderr: "", killed: false, ...result })) };
}

const VITE_CHUNK_WARNING = [
  "(!) Some chunks are larger than 500 kB after minification.",
  "- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.",
].join("\n");

describe("building the client before (re)starting", () => {
  it("treats exit code 0 as success even though vite warns on stderr", async () => {
    // The regression this guards: reading a non-existent `exitCode` made every
    // build look broken and reported this warning as the error.
    const pi = exec({ code: 0, stderr: VITE_CHUNK_WARNING });

    await expect(build(pi, "/repo")).resolves.toBeUndefined();
    expect(pi.exec).toHaveBeenCalledWith("npm", ["run", "build"], { cwd: "/repo" });
  });

  it("reports the last real output line when the build fails", async () => {
    const pi = exec({ code: 2, stderr: "src/web/app/App.tsx(12,3): error TS2339: Property 'nope'\n\n" });

    await expect(build(pi, "/repo")).resolves.toMatch(/error TS2339/);
  });

  it("falls back to stdout when a failing build said nothing on stderr", async () => {
    const pi = exec({ code: 1, stdout: "vite build exited early" });

    await expect(build(pi, "/repo")).resolves.toBe("vite build exited early");
  });

  it("still reports a failure that printed nothing at all", async () => {
    const pi = exec({ code: 137 });

    await expect(build(pi, "/repo")).resolves.toBe("npm run build exited with 137");
  });
});
