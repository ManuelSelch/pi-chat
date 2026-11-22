// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DiffStream } from "../DiffStream.js";
import type { ChangedFile } from "../../../contract.js";

const files: ChangedFile[] = ["first.ts","last.ts"].map(path=>({path,status:"M",patch:"@@ -1 +1 @@\n-old\n+new\n",binary:false,added:1,removed:1}));
let region: HTMLElement;
beforeEach(()=>{
  render(<MantineProvider><DiffStream files={files}/></MantineProvider>);
  region = screen.getByRole("region",{name:"All file diffs"});
});
afterEach(cleanup);

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
  region.children[0]!.getBoundingClientRect = ()=>({top:0,bottom:200} as DOMRect);
  fireEvent.click(screen.getByRole("button",{name:"last.ts"}));
  fireEvent.wheel(region);
  fireEvent.scroll(region);

  expect(screen.getByRole("button",{name:"first.ts"}).getAttribute("aria-pressed")).toBe("true");
});
