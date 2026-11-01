import { expect, it, vi } from "vitest";
import { chatBuildIdentity } from "../../../src/shared/node/build-identity.js";

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
