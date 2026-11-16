import { memo, type ReactNode } from "react";
import { common, createLowlight } from "lowlight";

// The same highlight.js grammars and token classes as rehype-highlight.
const highlighter = createLowlight(common);
type Token = ReturnType<typeof highlighter.highlight>["children"][number];
function tokenNode(token: Token, key: number): ReactNode {
  if (token.type === "text") return token.value;
  if (token.type !== "element") return null;
  const classes = token.properties.className;
  // Only React text/spans: never inject file content as HTML.
  return <span key={key} className={Array.isArray(classes) ? classes.join(" ") : undefined}>{token.children.map(tokenNode)}</span>;
}
export default memo(function FileHighlight({ children, language }: { children: string; language: string }) {
  if (!highlighter.registered(language)) return <>{children}</>;
  try {
    return <>{highlighter.highlight(language, children).children.map(tokenNode)}</>;
  } catch {
    // Invalid/incomplete snippets must still be readable.
    return <>{children}</>;
  }
});
