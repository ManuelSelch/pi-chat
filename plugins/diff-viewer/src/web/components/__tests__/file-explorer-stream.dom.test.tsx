// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, expect, it, vi } from "vitest";
import type { CodeViewProps } from "@pierre/diffs/react";
import type { ReviewComment } from "../../../domain/review.js";
import { DiffStream } from "../DiffStream.js";
import type { ChangedFile } from "../../../contract.js";

const {received}=vi.hoisted(()=>({received:vi.fn()}));
vi.mock("@pierre/diffs/react",()=>({
  WorkerPoolContextProvider:({children}:{children:ReactNode})=>children,
  CodeView:(props:CodeViewProps<ReviewComment,undefined>)=>{
    received(props);
    return <div>{props.items?.map(item=><div key={item.id}>{props.renderCustomHeader?.(item)}</div>)}</div>;
  },
}));
const files:ChangedFile[]=["first.ts","last.ts"].map(path=>({path,status:"M",patch:"@@ -1 +1 @@\n-old\n+new\n",binary:false,added:1,removed:1}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
function renderedPaths() {return (received.mock.calls.at(-1)![0] as CodeViewProps<ReviewComment,undefined>).items?.map(item=>item.id);}
it("filters full paths, virtualized items and totals while preserving an unmatched filter",()=>{
  render(<MantineProvider><DiffStream files={files}/></MantineProvider>);

  fireEvent.change(screen.getByRole("textbox",{name:"Filter files by path"}),{target:{value:"LAST"}});

  expect(screen.queryByRole("button",{name:"first.ts"})).toBeNull();
  expect(renderedPaths()).toEqual(["last.ts"]);
  expect(screen.getByText("1 file changed")).toBeTruthy();
  expect(screen.getByRole("contentinfo").textContent).toContain("+1");

  fireEvent.change(screen.getByRole("textbox",{name:"Filter files by path"}),{target:{value:"missing"}});

  expect(screen.getByText("0 files changed")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("No matching diffs");
  expect(screen.getByRole("textbox",{name:"Filter files by path"})).toBeTruthy();

  fireEvent.change(screen.getByRole("textbox",{name:"Filter files by path"}),{target:{value:""}});

  expect(screen.getByText("2 files changed")).toBeTruthy();
  expect(renderedPaths()).toEqual(["first.ts","last.ts"]);
});
it("uses identical kind/folder order for navigation and renderer items",()=>{
  const paths=["package.json","src/root.ts","src/feature/z.ts","docs/guide.md","tests/feature.test.ts","src/feature/a.ts"];
  render(<MantineProvider><DiffStream files={paths.map(path=>({...files[0]!,path}))}/></MantineProvider>);
  const expected=["src/feature/a.ts","src/feature/z.ts","src/root.ts","tests/feature.test.ts","docs/guide.md","package.json"];

  expect(renderedPaths()).toEqual(expected);
  expect(Array.from(screen.getByRole("navigation",{name:"Changed files"}).querySelectorAll("[aria-pressed]")).map(button=>button.getAttribute("aria-label"))).toEqual(expected);
});
it("collapsing navigation keeps every renderer item and total",()=>{
  render(<MantineProvider><DiffStream files={files}/></MantineProvider>);

  fireEvent.click(screen.getByRole("button",{name:"Source"}));

  expect(screen.queryByRole("button",{name:"first.ts"})).toBeNull();
  expect(renderedPaths()).toEqual(["first.ts","last.ts"]);
  expect(screen.getByText("2 files changed")).toBeTruthy();
});
