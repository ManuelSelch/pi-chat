// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DiffStream } from "../DiffStream.js";
import type { ChangedFile } from "../../../contract.js";

const files: ChangedFile[] = ["first.ts","last.ts"].map(path=>({path,status:"M",patch:"@@ -1 +1 @@\n-old\n+new\n",binary:false,added:1,removed:1}));
let region: HTMLElement;
let firstHeight:number;
let resized:()=>void;
beforeEach(()=>{
  firstHeight = 200;
  vi.stubGlobal("ResizeObserver",class {
    constructor(callback:()=>void) { resized=callback; }
    observe() {}
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype,"offsetTop","get").mockImplementation(function(this:HTMLElement) { return this.dataset.diffFile==="last.ts" ? firstHeight : 0; });
  vi.spyOn(HTMLElement.prototype,"offsetHeight","get").mockImplementation(function(this:HTMLElement) { return this.dataset.diffFile==="first.ts" ? firstHeight : 1000; });
  render(<MantineProvider><DiffStream files={files}/></MantineProvider>);
  region = screen.getByRole("region",{name:"All file diffs"});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

it("does not measure every file during scrolling",()=>{
  Object.defineProperties(region,{scrollHeight:{value:1200},clientHeight:{value:800}});
  const measure = vi.fn(()=>({top:0,bottom:200} as DOMRect));
  for (const child of region.children) child.getBoundingClientRect = measure;

  fireEvent.scroll(region);

  expect(measure).not.toHaveBeenCalled();
});

it("refreshes cached positions when file heights change",()=>{
  Object.defineProperties(region,{scrollHeight:{value:1600},clientHeight:{value:800}});
  firstHeight = 400;
  resized();
  region.scrollTop = 250;

  fireEvent.scroll(region);

  expect(screen.getByRole("button",{name:"first.ts"}).getAttribute("aria-pressed")).toBe("true");
});

it("renders all diffs rather than replacing content on file clicks", ()=>{
  fireEvent.click(screen.getByRole("button",{name:"last.ts"}));

  expect(screen.getByRole("region",{name:"Diff for first.ts"})).toBeTruthy();
  expect(screen.getByRole("region",{name:"Diff for last.ts"})).toBeTruthy();
});
it("retains clicked selection when scrolling is clamped at the end", ()=>{
  Object.defineProperties(region,{scrollHeight:{value:1200},clientHeight:{value:800}});
  fireEvent.click(screen.getByRole("button",{name:"last.ts"}));
  fireEvent.scroll(region);

  expect(screen.getByRole("button",{name:"last.ts"}).getAttribute("aria-pressed")).toBe("true");
});
it("retains selection when there is no scrollable overflow", ()=>{
  Object.defineProperties(region,{scrollHeight:{value:400},clientHeight:{value:800}});
  fireEvent.click(screen.getByRole("button",{name:"last.ts"}));
  fireEvent.wheel(region);
  fireEvent.scroll(region);

  expect(screen.getByRole("button",{name:"last.ts"}).getAttribute("aria-pressed")).toBe("true");
});
it("resumes visible-file tracking after a deliberate manual scroll", ()=>{
  Object.defineProperties(region,{scrollHeight:{value:1200},clientHeight:{value:800}});
  fireEvent.click(screen.getByRole("button",{name:"last.ts"}));
  fireEvent.wheel(region);
  fireEvent.scroll(region);

  expect(screen.getByRole("button",{name:"first.ts"}).getAttribute("aria-pressed")).toBe("true");
});
