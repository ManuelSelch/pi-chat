import type { BlockContent, DefinitionContent, Literal, Parent, PhrasingContent, Root } from "mdast";

interface InlineMathNode extends Literal {
  type: "inlineMath";
  value: string;
}

interface DisplayMathNode {
  type: "math";
  value: string;
}

function isInlineMath(node: PhrasingContent): node is InlineMathNode {
  return (node as InlineMathNode).type === "inlineMath" && typeof (node as InlineMathNode).value === "string";
}

function isBlankText(node: PhrasingContent): boolean {
  return node.type === "text" && node.value.trim() === "";
}

/**
 * Promote single-line `$$...$$` to display math.
 *
 * With `singleDollarTextMath: false`, remark-math parses `$$E = mc^2$$` on one
 * line as *inline* math (the `$$` are inline delimiters), while models write
 * exactly that form for display formulas. A paragraph whose only real content
 * is one inline-math node is unambiguously a display formula, so it becomes a
 * `math` node and rehype-katex renders it with `katex-display`.
 */
export function remarkDisplayMath() {
  return (tree: Root) => {
    transform(tree);
  };
}

function transform(parent: Parent | Root): void {
  const children = parent.children as Array<BlockContent | DefinitionContent | PhrasingContent>;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]!;
    if (child.type === "paragraph") {
      const significant = child.children.filter((node) => !isBlankText(node));
      if (significant.length === 1 && isInlineMath(significant[0]!)) {
        const value = significant[0]!.value;
        // Mirror mdast-util-math's display node: the hName/hChildren data is
        // what remark-rehype turns into <pre><code class="math-display">.
        children[index] = {
          type: "math",
          value,
          data: {
            hName: "pre",
            hChildren: [
              {
                type: "element",
                tagName: "code",
                properties: { className: ["language-math", "math-display"] },
                children: [{ type: "text", value }],
              },
            ],
          },
        } as unknown as DisplayMathNode as never;
        continue;
      }
      const inline = parseInlineMath(child.children);
      if (inline) child.children = inline;
    }
    if ("children" in child && Array.isArray(child.children)) {
      transform(child as Parent);
    }
  }
}

function parseInlineMath(nodes: PhrasingContent[]): PhrasingContent[] | undefined {
  let changed = false;
  const next: PhrasingContent[] = [];
  for (const node of nodes) {
    if (node.type !== "text") {
      next.push(node);
      continue;
    }
    const parsed = parseInlineMathText(node.value);
    changed ||= parsed.length !== 1 || parsed[0]?.type !== "text" || parsed[0].value !== node.value;
    next.push(...parsed);
  }
  return changed ? next : undefined;
}

function parseInlineMathText(text: string): PhrasingContent[] {
  const nodes: PhrasingContent[] = [];
  let cursor = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!isOpeningDollar(text, index)) continue;
    const close = findClosingDollar(text, index + 1);
    if (close === -1) continue;
    if (cursor < index) nodes.push({ type: "text", value: text.slice(cursor, index) });
    const value = text.slice(index + 1, close);
    nodes.push(inlineMathNode(value) as PhrasingContent);
    cursor = close + 1;
    index = close;
  }
  if (cursor < text.length) nodes.push({ type: "text", value: text.slice(cursor) });
  return nodes.length === 0 ? [{ type: "text", value: text }] : nodes;
}

function findClosingDollar(text: string, start: number): number {
  for (let index = start; index < text.length; index += 1) {
    if (isClosingDollar(text, index)) return index;
  }
  return -1;
}

function isOpeningDollar(text: string, index: number): boolean {
  return (
    text[index] === "$" &&
    text[index - 1] !== "\\" &&
    text[index + 1] !== "$" &&
    text[index + 1] !== undefined &&
    !/\s/.test(text[index + 1]!)
  );
}

function isClosingDollar(text: string, index: number): boolean {
  return (
    text[index] === "$" &&
    text[index - 1] !== "\\" &&
    text[index - 1] !== "$" &&
    text[index - 1] !== undefined &&
    !/\s/.test(text[index - 1]!)
  );
}

function inlineMathNode(value: string): InlineMathNode {
  return {
    type: "inlineMath",
    value,
    data: {
      hName: "code",
      hProperties: { className: ["language-math", "math-inline"] },
      hChildren: [{ type: "text", value }],
    },
  } as InlineMathNode;
}
