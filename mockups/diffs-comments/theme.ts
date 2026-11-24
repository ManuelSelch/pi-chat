import { registerCustomCSSVariableTheme } from "@pierre/diffs";

// Mirrors Pi Chat Classic Dark. CSS variables keep the palette host-owned.
export const diffTheme = "pi-chat-preview";
registerCustomCSSVariableTheme(diffTheme, {
  foreground:"#adbac7",background:"#242424",
  "token-comment":"#768390","token-keyword":"#f47067",
  "token-string":"#96d0ff","token-string-expression":"#96d0ff",
  "token-constant":"#6cb6ff","token-function":"#dcbdfb",
  "token-parameter":"#f69d50","token-punctuation":"#adbac7",
  "token-link":"#4dabf7","token-inserted":"#40c057","token-deleted":"#fa5252",
});
export const diffCSS = `
:host {
  --diffs-font-size:12px;
  --diffs-line-height:24px;
  --diffs-font-family:var(--mantine-font-family-monospace);
  --diffs-background:var(--page);
  --diffs-foreground:#adbac7;
  --diffs-bg:var(--page);
  --diffs-fg:var(--diffs-foreground);
  --diffs-bg-buffer-override:var(--page);
  --diffs-bg-context-override:var(--page);
  --diffs-bg-context-gutter-override:var(--page);
  --diffs-bg-separator-override:var(--panel);
  --diffs-fg-number-override:var(--muted);
  --diffs-addition-color-override:var(--added);
  --diffs-deletion-color-override:var(--removed);
  --diffs-modified-color-override:#228be6;
  --diffs-bg-hover-override:var(--hover);
}
[data-line-annotation], [data-gutter-buffer="annotation"] {
  background:var(--page);
  --diffs-computed-selected-line-bg:var(--page);
  --diffs-computed-hovered-line-bg:var(--page);
}
`;
