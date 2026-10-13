import { expect, it } from "vitest";
import { chatMessageSchema } from "../../../../../src/shared/protocol.js";
import { MessageIdentity, toChatMessage, toChatMessages } from "../../../../../src/server/runtime/pi/message-mapping.js";

const block = '<skill name="daily-briefing" location="/skills/daily-briefing/SKILL.md">\nReferences are relative to /skills/daily-briefing.\n\nPrepare the briefing.\n</skill>';
const skill = { name: "daily-briefing", location: "/skills/daily-briefing/SKILL.md", content: "References are relative to /skills/daily-briefing.\n\nPrepare the briefing." };

it.each(["", "\n\nSummarize today."])("projects a skill block and task text separately: %j", suffix => {
  const original = { role: "user", content: [{ type: "text", text: block + suffix }], timestamp: 1 };
  const identity = new MessageIdentity();
  const projected = toChatMessages(original, identity);
  expect(projected).toHaveLength(1);
  expect(projected[0]).toMatchObject({ role: "user", skill, text: suffix.trim(), timestamp: 1 });
  expect(chatMessageSchema.parse(projected[0])).toEqual(projected[0]);
  expect(toChatMessage(original, identity)).toEqual(projected[0]);
  expect(original.content[0]?.text).toBe(block + suffix);
});

it.each([
  "/skill:missing task",
  '<skill name="broken">\nIncomplete\n</skill>',
  `Mentioned block:\n${block}`,
])("keeps ordinary and malformed user messages unchanged: %s", text => {
  const projected = toChatMessage({ role: "user", content: text }, new MessageIdentity());
  expect(projected).toMatchObject({ text });
  expect(projected).not.toHaveProperty("skill");
});

it.each(["assistant", "system", "custom"])("does not reinterpret %s content as a skill invocation", role => {
  const projected = toChatMessage({ role, content: block, display: true, customType: "fixture" }, new MessageIdentity());
  expect(projected).toMatchObject({ text: block });
  expect(projected).not.toHaveProperty("skill");
});
