import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { remarkDisplayMath } from "../../../../../src/web/chat/markdown/remark-display-math.js";

const text = (value: string) => ({ type: "text", value });
const math = (value: string) => ({ type: "inlineMath", value });

function parseText(value: string) {
  const tree: Root = {
    type: "root",
    children: [{ type: "paragraph", children: [{ type: "text", value }] }],
  };
  remarkDisplayMath()(tree);
  const paragraph = tree.children[0];
  if (paragraph?.type !== "paragraph") throw new Error("Expected inline paragraph");
  return paragraph.children.map(node => ({
    type: node.type,
    ...("value" in node ? { value: node.value } : {}),
  }));
}

describe("inline math scanner advancement", () => {
  it.each([
    { name: "empty text", input: "", expected: [text("")] },
    { name: "plain text", input: "ordinary text", expected: [text("ordinary text")] },
    { name: "multiple formulas", input: "Before $x$ between $y$ after", expected: [text("Before "), math("x"), text(" between "), math("y"), text(" after")] },
    { name: "adjacent formulas", input: "$x$$y$", expected: [math("x"), math("y")] },
    { name: "leading formula", input: "$x$tail", expected: [math("x"), text("tail")] },
    { name: "trailing formula", input: "prefix$x$", expected: [text("prefix"), math("x")] },
    { name: "unmatched opener", input: "prefix $x", expected: [text("prefix $x")] },
    { name: "unmatched opener after a formula", input: "$x$ then $y", expected: [math("x"), text(" then $y")] },
    { name: "escaped opening dollar", input: "\\$literal and $x$", expected: [text("\\$literal and "), math("x")] },
    { name: "escaped closing dollar inside a formula", input: "$x\\$y$", expected: [math("x\\$y")] },
    { name: "escaped closing dollar without a real closer", input: "$x\\$", expected: [text("$x\\$")] },
    { name: "prices", input: "The price is $5 and $10.", expected: [text("The price is $5 and $10.")] },
    { name: "whitespace after opening dollar", input: "$ x$", expected: [text("$ x$")] },
    { name: "whitespace before closing dollar", input: "$x $", expected: [text("$x $")] },
    { name: "single terminal dollar", input: "$", expected: [text("$")] },
  ])("preserves $name", ({ input, expected }) => {
    expect(parseText(input)).toEqual(expected);
  });

  it("preserves code nodes and does not pair dollars across node boundaries", () => {
    const tree: Root = {
      type: "root",
      children: [
        { type: "paragraph", children: [
          { type: "text", value: "$left" },
          { type: "inlineCode", value: "$code$" },
          { type: "text", value: "right$" },
        ] },
        { type: "code", lang: "text", value: "$fenced$" },
      ],
    };
    const before = structuredClone(tree);
    remarkDisplayMath()(tree);
    expect(tree).toEqual(before);
  });
});
