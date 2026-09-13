import { memo, type AnchorHTMLAttributes, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { remarkDisplayMath } from "./remark-display-math.js";

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Links: only http/https/mailto survive; anything else degrades to its text.
 * External links open in a new tab without window access to this page.
 */
function SafeLink({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) {
  let url: URL | undefined;
  try {
    url = href ? new URL(href, "https://invalid.invalid") : undefined;
  } catch {
    url = undefined;
  }
  if (!url || !SAFE_PROTOCOLS.has(url.protocol)) return <span>{children}</span>;
  return (
    <a href={href} rel="noopener noreferrer" target="_blank" {...rest}>
      {children}
    </a>
  );
}

/**
 * Markdown renderer shared by user and assistant text.
 *
 * - GFM: tables, lists, links.
 * - Math: display formulas with `$$ ... $$`, plus Obsidian-style inline
 *   `$...$` when neither delimiter touches whitespace. This renders `$1+1$`
 *   while keeping `$1 $2` and common price text literal.
 * - Raw HTML in the source is dropped by react-markdown (no rehype-raw), so
 *   model output can never inject markup or scripts.
 * - Code fences get highlight.js classes via rehype-highlight.
 */
export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }], remarkDisplayMath]}
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
      components={{ a: SafeLink }}
    >
      {children}
    </ReactMarkdown>
  );
});
