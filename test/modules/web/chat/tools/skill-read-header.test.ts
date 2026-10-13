import { expect, it } from "vitest";
import { skillReadHeader } from "../../../../../src/web/chat/tools/skill-read-header.js";
import type { ToolCard } from "../../../../../src/shared/protocol.js";

const tool = (args: unknown, name = "read"): ToolCard => ({ toolCallId: "read-1", name, status: "running", argsText: JSON.stringify(args) });

it.each([
  "/Users/user/.pi/agent/skills/daily-briefing/SKILL.md",
  "skills/daily-briefing/SKILL.md",
  "./skills/daily-briefing/SKILL.md",
  "~/.pi/agent/skills/daily-briefing/SKILL.md",
  "C:\\skills\\daily-briefing\\SKILL.md",
])("labels skill reads by parent directory: %s", path => {
  expect(skillReadHeader(tool({ path }))).toEqual({ name: "[skill]", subject: "daily-briefing" });
});

it("uses file_path before path and does not consult frontmatter or loaded skills", () => {
  expect(skillReadHeader(tool({ file_path: "/external/different-name/SKILL.md", path: "/skills/ignored/SKILL.md" })))
    .toEqual({ name: "[skill]", subject: "different-name" });
  expect(skillReadHeader(tool({ file_path: "README.md", path: "skills/ignored/SKILL.md" }))).toBeUndefined();
  expect(skillReadHeader(tool({ file_path: null, path: "skills/fallback/SKILL.md" })))
    .toEqual({ name: "[skill]", subject: "fallback" });
});

it.each(["skill.md", "SKILL.MD", "SKILL.md.backup", "README.md", "SKILL.md/references.md"])("leaves non-skill filename %s unchanged", filename => {
  expect(skillReadHeader(tool({ path: `skills/daily-briefing/${filename}` }))).toBeUndefined();
});

it.each(["write", "edit", "bash", "custom_read"])("does not relabel %s calls", name => {
  expect(skillReadHeader(tool({ path: "skills/daily-briefing/SKILL.md" }, name))).toBeUndefined();
});

it.each([undefined, "", "null", "[]", "3", '{"path":3}', '{"path":"skills/daily-briefing/SKILL.md', '{"path":"skills/daily-briefing/SKILL.md",'])
  ("leaves malformed or incomplete argument JSON unchanged: %s", argsText => {
    expect(skillReadHeader({ toolCallId: "read-1", name: "read", status: "running", argsText })).toBeUndefined();
  });

it.each([
  [{}, "daily-briefing"],
  [{ offset: null, limit: null }, "daily-briefing"],
  [{ offset: 5 }, "daily-briefing:5"],
  [{ limit: 3 }, "daily-briefing:1-3"],
  [{ offset: 5, limit: 3 }, "daily-briefing:5-7"],
  [{ offset: null, limit: 3 }, "daily-briefing:1-3"],
])("retains line range %j", (range, subject) => {
  expect(skillReadHeader(tool({ path: "skills/daily-briefing/SKILL.md", ...range })))
    .toEqual({ name: "[skill]", subject });
});
