import type { BlockContent, DefinitionContent, Parent, PhrasingContent, Root } from "mdast";

interface InlineMathNode {
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
    }
    if ("children" in child && Array.isArray(child.children)) {
      transform(child as Parent);
    }
  }
}
