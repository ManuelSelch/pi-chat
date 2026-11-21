import type { Root, RootContent } from "hast";

/** JSX lint cannot see title attributes generated from Markdown or plugins. */
export function rehypeNoNativeTooltips() {
  return (tree: Root) => {
    stripTitles(tree);
  };
}

function stripTitles(node: Root | RootContent): void {
  if (node.type === "element") delete node.properties.title;
  if ("children" in node)
    for (const child of node.children) stripTitles(child);
}
