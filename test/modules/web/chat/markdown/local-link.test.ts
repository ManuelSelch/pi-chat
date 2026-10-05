import { describe, expect, it } from "vitest";
import { localPathFromHref, openLocalLinkCommand, shellQuote } from "../../../../../src/web/chat/markdown/local-link.js";

describe("local Markdown links", () => {
  it.each(["report.pdf", "./report.pdf", "../report.pdf", "/tmp/report.pdf", "file:///tmp/report.pdf"])("recognizes %s", (href) => {
    expect(localPathFromHref(href)).toBe(href.startsWith("file:") ? "/tmp/report.pdf" : href);
  });

  it.each(["https://example.com", "mailto:user@example.com", "javascript:alert(1)", "#section"])("does not recognize %s", (href) => {
    expect(localPathFromHref(href)).toBeUndefined();
  });

  it("quotes apostrophes for bash", () => {
    expect(shellQuote("a'b.pdf")).toBe(`'a'"'"'b.pdf'`);
    expect(openLocalLinkCommand("report.pdf")).toBe("!!open -- 'report.pdf'");
  });
});
