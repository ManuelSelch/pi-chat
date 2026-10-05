import { describe, expect, it } from "vitest";
import { localPathFromHref, openLocalLinkCommand, shellQuote } from "../../../../../src/web/chat/markdown/local-link.js";

describe("local Markdown links", () => {
  it.each(["report.pdf", "./report.pdf", "../report.pdf", "/tmp/report.pdf", "file:///tmp/report.pdf"])("recognizes %s", (href) => {
    expect(localPathFromHref(href)).toBe(href.startsWith("file:") ? "/tmp/report.pdf" : href);
  });

  it.each(["https://example.com", "mailto:user@example.com", "javascript:alert(1)", "#section"])("does not recognize %s", (href) => {
    expect(localPathFromHref(href)).toBeUndefined();
  });

  it.each([
    ["file://localhost/tmp/report.pdf", "/tmp/report.pdf"],
    ["FILE:///tmp/report.pdf", "/tmp/report.pdf"],
    ["file:/tmp/report.pdf", "/tmp/report.pdf"],
    ["file:///tmp/r%C3%A9sum%C3%A9%20O%27Brien.pdf#page=2", "/tmp/résumé O'Brien.pdf"],
    ["./a%20b.pdf?download=1#page=2", "./a b.pdf"],
    ["../report.pdf#page=2", "../report.pdf"],
    ["/tmp/a%23b%3Fc.pdf", "/tmp/a#b?c.pdf"],
    ["./a%2520b.pdf", "./a%20b.pdf"],
    ["./résumé O'Brien.pdf", "./résumé O'Brien.pdf"],
    ["-report.pdf", "-report.pdf"],
  ])("extracts the path once from %s", (href, path) => {
    expect(localPathFromHref(href)).toBe(path);
  });

  it.each([
    "", "   ", "#section", "?download=1", "//host/report.pdf", "\\\\host\\report.pdf",
    "file://host/tmp/report.pdf", "file://user@localhost/tmp/report.pdf", "file://localhost:123/tmp/report.pdf",
    "file:///tmp/bad%ZZ.pdf", "./bad%.pdf", "./bad%C3.pdf", "./a%00.pdf", "./a%0A.pdf",
    "./a\n.pdf", "file:///tmp/a\t.pdf", "file:///tmp/a%7F.pdf", "file:///tmp/a%C2%85.pdf",
    "%2F%2Fhost/report.pdf", "./" + "x".repeat(4096), "https://example.com/a.pdf", "data:text/plain,hello",
  ])("rejects unsafe or ambiguous href %s", (href) => {
    expect(localPathFromHref(href)).toBeUndefined();
  });

  it("quotes apostrophes for bash", () => {
    expect(shellQuote("a'b.pdf")).toBe(`'a'"'"'b.pdf'`);
    expect(openLocalLinkCommand("report.pdf")).toBe("!!open -- 'report.pdf'");
  });
});
