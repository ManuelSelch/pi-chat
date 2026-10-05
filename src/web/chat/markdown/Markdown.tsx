import { memo, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { remarkDisplayMath } from "./remark-display-math.js";
import { localPathFromHref } from "./local-link.js";

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * External links are limited to http/https/mailto and open in a new tab.
 * Relative and file:// links are handed to the local-open action when supplied.
 */
function SafeLink({ href, children, onLocalLink, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode; onLocalLink?: (path: string) => void }) {
  const localPath = href ? localPathFromHref(href) : undefined;
  if (localPath && !onLocalLink) return <span>{children}</span>;
  if (localPath) {
    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (!onLocalLink) return;
      event.preventDefault();
      onLocalLink(localPath);
    };
    return <a href={href} onClick={handleClick} {...rest}>{children}</a>;
  }

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
export const Markdown = memo(function Markdown({ children, disableImages = false, onLocalLink }: { children: string; disableImages?: boolean; onLocalLink?: (path: string) => void }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }], remarkDisplayMath]}
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
      urlTransform={(url) => url.startsWith("file:") ? url : defaultUrlTransform(url)}
      components={{ a: (props) => <SafeLink {...props} onLocalLink={onLocalLink} />, ...(disableImages ? { img: ({ alt }: { alt?: string }) => <span>{alt ?? ""}</span> } : {}) }}
    >
      {children}
    </ReactMarkdown>
  );
});
