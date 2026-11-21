import { lazy, Suspense, type ComponentProps } from "react";

const MarkdownRenderer = lazy(() =>
  import("./Markdown.js").then(({ Markdown }) => ({ default: Markdown })),
);

/**
 * Keep the Markdown/KaTeX/highlighting pipeline out of the initial bundle.
 * The renderer is loaded when the first transcript content is displayed.
 */
export function Markdown(props: ComponentProps<typeof MarkdownRenderer>) {
  return (
    <Suspense fallback={<span aria-hidden="true" />}>
      <MarkdownRenderer {...props} />
    </Suspense>
  );
}
