import { Box, Text } from "@mantine/core";
import { lazy, Suspense } from "react";
import { Markdown } from "../markdown/MarkdownLazy.js";
import { THEME } from "../../ui/theme.js";
import { fileLanguage } from "./file-language.js";

const FileHighlight = lazy(() => import("./FileHighlight.js"));

/** Shared by literal file previews and code within edit diff rows. */
export function FileCode({ children, path }: { children: string; path?: string }) {
  const language = fileLanguage(path);
  return <code className={language ? `hljs language-${language}` : undefined}>
    {language ? <Suspense fallback={children}><FileHighlight language={language}>{children}</FileHighlight></Suspense> : children}
  </code>;
}

/** Pi continuation notices and our output-budget marker are not file source. */
export function ReadContent({ children, path }: { children: string; path?: string }) {
  const notice = /(?:\n\n\[(?:Showing lines [^\n]*Use offset=\d+ to continue\.|\d+ more lines in file\. Use offset=\d+ to continue\.)\]|… \[truncated\])$/.exec(children);
  return <>
    <FileContent path={path}>{notice ? children.slice(0, notice.index) : children}</FileContent>
    {notice ? <Text size="xs" c="dimmed" mt={4}>{notice[0].trim()}</Text> : null}
  </>;
}

export function FileContent({ children, path }: { children: string; path?: string }) {
  if (fileLanguage(path) === "markdown") {
    return <Box className="markdown" style={{ overflowWrap: "anywhere" }}><Markdown disableImages>{children}</Markdown></Box>;
  }
  return <Box component="pre" m={0} p="sm" ff="monospace" fz={12} lh={1.5} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: THEME.surface.page, border: `1px solid ${THEME.border.default}`, borderRadius: "var(--mantine-radius-sm)" }}>
    <FileCode path={path}>{children}</FileCode>
  </Box>;
}
