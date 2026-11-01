import { execFileSync } from "node:child_process";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
import { chatBuildIdentity } from "../../../src/shared/node/build-identity.js";

it("uses system Git rather than a PATH-provided executable", () => {
  vi.stubEnv("PATH", "/untrusted/bin");
  vi.mocked(execFileSync).mockReturnValueOnce("").mockReturnValueOnce("v0.3.0\n");

  expect(chatBuildIdentity()).toBe("v0.3.0");

  expect(execFileSync).toHaveBeenNthCalledWith(1, "/usr/bin/git", ["status", "--porcelain"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  expect(execFileSync).toHaveBeenNthCalledWith(2, "/usr/bin/git", ["describe", "--tags", "--exact-match", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
});

it("returns dev without a PATH fallback if system Git is unavailable", () => {
  vi.mocked(execFileSync).mockImplementation(() => { throw new Error("ENOENT"); });

  expect(chatBuildIdentity()).toBe("dev");

  expect(execFileSync).toHaveBeenCalledOnce();
});

it("uses exact tags only for clean tagged builds", () => {
  const git = vi.fn((args: string[]) => args[0] === "status" ? "" : args[0] === "describe" ? "v0.3.0\n" : "abc1234\n");
  expect(chatBuildIdentity(git)).toBe("v0.3.0");
});
it("labels untagged and dirty builds as dev rather than using a commit or placeholder version", () => {
  expect(chatBuildIdentity(args => {
    if (args[0] === "describe") throw new Error("no tag");
    return args[0] === "status" ? "" : "abc1234";
  })).toBe("dev");
  expect(chatBuildIdentity(args => args[0] === "status" ? " M file" : "abc1234")).toBe("dev");
});
it("does not invent a release version without Git metadata", () => {
  expect(chatBuildIdentity(() => { throw new Error("no git"); })).toBe("dev");
});
