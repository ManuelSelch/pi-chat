// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FileDiff } from "../FileDiff.js";
import type { ChangedFile } from "../../../contract.js";
import type { HighlightSegment } from "../../lib/highlight-patch.js";
import type { RequestHighlight } from "../../lib/highlight-worker-client.js";
import * as highlighting from "../../lib/highlight-patch.js";

const file:ChangedFile = {path:"test.ts",status:"M",patch:"@@ -0,0 +1 @@\n+const value = 1;\n",binary:false,added:1,removed:0};
let visibility:IntersectionObserverCallback;
let disconnect:ReturnType<typeof vi.fn>;
let cancel:ReturnType<typeof vi.fn<()=>void>>;
let request:ReturnType<typeof vi.fn<RequestHighlight>>;
let complete:(tokens:HighlightSegment[][])=>void;

beforeEach(()=>{
  disconnect = vi.fn();
  cancel = vi.fn();
  request = vi.fn((_path,_lines,done)=>{complete=done;return cancel;});
  vi.stubGlobal("IntersectionObserver",class {
    constructor(callback:IntersectionObserverCallback) { visibility=callback; }
    observe() {}
    disconnect = disconnect;
  });
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

function setVisible(value:boolean) {
  act(()=>visibility([{isIntersecting:value} as IntersectionObserverEntry],{} as IntersectionObserver));
}
function content(selected=file,wrap=true) {
  return <MantineProvider><FileDiff file={selected} wrap={wrap} onHighlight={request}/></MantineProvider>;
}

it("does not tokenize offscreen files on the UI thread",()=>{
  const tokenize = vi.spyOn(highlighting,"highlightPatch");
  render(content());

  expect(tokenize).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole("code").textContent).toBe("const value = 1;");
});

it("shows plain code first and requests highlighting only near the viewport",()=>{
  render(content());
  setVisible(true);

  expect(request).toHaveBeenCalledOnce();
  expect(screen.getByRole("code").querySelector("span")).toBeNull();

  act(()=>complete([[],[{text:"const",classes:["hljs-keyword"]},{text:" value = 1;",classes:[]}]]));

  expect(screen.getByRole("code").querySelector(".hljs-keyword")?.textContent).toBe("const");
  expect(screen.getByRole("code").textContent).toBe("const value = 1;");
});

it("cancels work when leaving the viewport and ignores its late result",()=>{
  render(content());
  setVisible(true);
  setVisible(false);
  act(()=>complete([[],[{text:"stale",classes:["hljs-keyword"]}]]));

  expect(cancel).toHaveBeenCalledOnce();
  expect(screen.getByRole("code").textContent).toBe("const value = 1;");
  expect(screen.getByRole("code").querySelector(".hljs-keyword")).toBeNull();
});

it("does not request collapsed deleted-file highlighting until expanded",()=>{
  render(content({...file,status:"D"}));
  setVisible(true);

  expect(request).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button",{name:"Expand test.ts"}));

  expect(request).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button",{name:"Collapse test.ts"}));

  expect(cancel).toHaveBeenCalledOnce();
});

it("reuses completed highlighting across wrapping changes and viewport reentry",()=>{
  const view = render(content());
  setVisible(true);
  act(()=>complete([[],[{text:"const value = 1;",classes:[]}]]));
  view.rerender(content(file,false));
  setVisible(false);
  setVisible(true);

  expect(request).toHaveBeenCalledOnce();
  expect(screen.getByRole("code").classList.contains("whitespace-pre")).toBe(true);
});

it("ignores stale results when the patch changes",()=>{
  const view = render(content());
  setVisible(true);
  const oldComplete = complete;
  view.rerender(content({...file,patch:"@@ -0,0 +1 @@\n+const next = 2;\n"}));
  act(()=>oldComplete([[],[{text:"old",classes:["hljs-keyword"]}]]));

  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("code").textContent).toBe("const next = 2;");
});

it("does not rebuild unchanged file content on parent updates",()=>{
  const reads = vi.fn(()=>1);
  const stable = {...file,get added() { return reads(); }};
  const view = render(content(stable));
  reads.mockClear();

  view.rerender(content(stable));

  expect(reads).not.toHaveBeenCalled();
});

it("disconnects observers and cancels pending work on unmount",()=>{
  const view = render(content());
  setVisible(true);
  view.unmount();

  expect(disconnect).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
});
