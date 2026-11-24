import { registerCustomCSSVariableTheme } from "@pierre/diffs";

export const diffTheme = "pi-chat-diff";
registerCustomCSSVariableTheme(diffTheme,{
  foreground:"#adbac7",background:"#242424","token-comment":"#768390",
  "token-keyword":"#f47067","token-string":"#96d0ff","token-string-expression":"#96d0ff",
  "token-constant":"#6cb6ff","token-function":"#dcbdfb","token-parameter":"#f69d50",
  "token-punctuation":"#adbac7","token-link":"#4dabf7","token-inserted":"#40c057","token-deleted":"#fa5252",
});
/** Applied inside the renderer shadow root; never changes host/global tokens. */
export const diffCSS = `
:host {
  --diffs-font-size:12px;
  --diffs-line-height:24px;
  --diffs-font-family:var(--mantine-font-family-monospace);
  --diffs-background:var(--mantine-color-body);
  --diffs-foreground:var(--hljs-text,var(--mantine-color-text));
  --diffs-token-comment:var(--hljs-comment,var(--mantine-color-dimmed));
  --diffs-token-keyword:var(--hljs-keyword,var(--mantine-color-text));
  --diffs-token-string:var(--hljs-string,var(--mantine-color-text));
  --diffs-token-string-expression:var(--hljs-string,var(--mantine-color-text));
  --diffs-token-constant:var(--hljs-number,var(--mantine-color-text));
  --diffs-token-function:var(--hljs-function,var(--mantine-color-text));
  --diffs-token-parameter:var(--hljs-builtin,var(--mantine-color-text));
  --diffs-token-punctuation:var(--hljs-text,var(--mantine-color-text));
  --diffs-token-link:var(--mantine-color-anchor);
  --diffs-token-inserted:var(--pi-diff-added);
  --diffs-token-deleted:var(--pi-diff-removed);
  --diffs-bg:var(--mantine-color-body);
  --diffs-fg:var(--diffs-foreground);
  --diffs-bg-buffer-override:var(--mantine-color-body);
  --diffs-bg-context-override:var(--mantine-color-body);
  --diffs-bg-context-gutter-override:var(--mantine-color-body);
  --diffs-bg-separator-override:var(--mantine-color-default);
  --diffs-fg-number-override:var(--mantine-color-dimmed);
  --diffs-addition-color-override:var(--pi-diff-added);
  --diffs-deletion-color-override:var(--pi-diff-removed);
  --diffs-modified-color-override:var(--mantine-primary-color-filled);
  --diffs-bg-hover-override:var(--mantine-color-default-hover);
}
[data-background] [data-column-number], [data-background] [data-gutter-buffer] {
  --mix-dark:80%;
  --mix-light:88%;
}
[data-line-annotation], [data-gutter-buffer="annotation"] {
  background:var(--mantine-color-body);
  --diffs-computed-selected-line-bg:var(--mantine-color-body);
  --diffs-computed-hovered-line-bg:var(--mantine-color-body);
}
`;
