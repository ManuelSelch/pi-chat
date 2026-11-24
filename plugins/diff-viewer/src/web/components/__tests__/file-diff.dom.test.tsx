// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { FileDiff as FileDiffView } from "../FileDiff.js";
import { DiffLines } from "../DiffLines.js";
import { parsePatch } from "../../../domain/parse-patch.js";
import { highlightPatch } from "../../lib/highlight-patch.js";

const noHighlight = ()=>()=>{};
function FileDiff(props:{file:ChangedFile;wrap?:boolean}) {
  return <FileDiffView {...props} onHighlight={noHighlight}/>;
}
import type { ChangedFile } from "../../../contract.js";

const file: ChangedFile = {path:"deleted.ts",status:"D",patch:"@@ -1 +0,0 @@\n-removed content\n",binary:false,added:0,removed:1};
afterEach(cleanup);

it("collapses deleted patches by default while preserving their heading and counts",()=>{
  render(<MantineProvider><FileDiff file={file}/></MantineProvider>);

  expect(screen.queryByText("removed content")).toBeNull();
  expect(screen.getByText("deleted.ts")).toBeTruthy();
  expect(screen.getByText("−1")).toBeTruthy();
  expect(screen.getByRole("button",{name:"Expand deleted.ts"}).getAttribute("aria-expanded")).toBe("false");
});

it("lets deleted patches expand and collapse",()=>{
  render(<MantineProvider><FileDiff file={file}/></MantineProvider>);
  fireEvent.click(screen.getByRole("button",{name:"Expand deleted.ts"}));

  expect(screen.getByText("removed content")).toBeTruthy();
  expect(screen.getByRole("button",{name:"Collapse deleted.ts"}).getAttribute("aria-expanded")).toBe("true");

  fireEvent.click(screen.getByRole("button",{name:"Collapse deleted.ts"}));

  expect(screen.queryByText("removed content")).toBeNull();
});

it("wraps long content without changing whitespace or line numbers",()=>{
  const text = "  const value = \""+"x".repeat(240)+"\";";
  render(<MantineProvider><FileDiff file={{...file,status:"M",patch:"@@ -0,0 +1 @@\n+"+text+"\n"}}/></MantineProvider>);

  const code = screen.getByRole("code");
  expect(code.textContent).toBe(text);
  expect(code.classList.contains("whitespace-pre-wrap")).toBe(true);
  expect(code.classList.contains("wrap-anywhere")).toBe(true);
});

it("can disable wrapping without changing content",()=>{
  const view = render(<MantineProvider><FileDiff file={{...file,status:"M"}}/></MantineProvider>);
  view.rerender(<MantineProvider><FileDiff file={{...file,status:"M"}} wrap={false}/></MantineProvider>);

  const code = screen.getByText("removed content");
  expect(code.classList.contains("whitespace-pre")).toBe(true);
  expect(code.classList.contains("whitespace-pre-wrap")).toBe(false);
  expect(code.parentElement?.parentElement?.classList.contains("w-max")).toBe(true);
});

it("highlights code safely without changing its text or diff layout",()=>{
  const patch = '@@ -1 +1 @@\n-const before = "<script>bad()</script>";\n+const after = "safe";\n';
  const lines = parsePatch(patch);
  render(<MantineProvider><DiffLines lines={lines} highlighted={highlightPatch(file.path,lines)} wrap={true}/></MantineProvider>);

  const code = screen.getAllByRole("code");
  expect(code[0]!.textContent).toBe('const before = "<script>bad()</script>";');
  expect(code[1]!.textContent).toBe('const after = "safe";');
  expect(code[0]!.querySelector(".hljs-keyword")?.textContent).toBe("const");
  expect(code[1]!.querySelector(".hljs-string")?.textContent).toBe('"safe"');
  expect(code[0]!.querySelector("script")).toBeNull();
  expect(code[1]!.classList.contains("whitespace-pre-wrap")).toBe(true);
});

it("keeps modified patches expanded",()=>{
  render(<MantineProvider><FileDiff file={{...file,status:"M"}}/></MantineProvider>);

  expect(screen.getByText("removed content")).toBeTruthy();
});
