// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, expect, it, vi } from "vitest";
import type { CodeViewProps, CodeViewHandle } from "@pierre/diffs/react";
import type { ReviewComment } from "../../../domain/review.js";
import { DiffStream } from "../DiffStream.js";
import type { ChangedFile } from "../../../contract.js";

const {scrollTo,clearSelectedLines,received}=vi.hoisted(()=>({scrollTo:vi.fn(),clearSelectedLines:vi.fn(),received:vi.fn()}));
vi.mock("@pierre/diffs/react",()=>({
  WorkerPoolContextProvider:({children}:{children:ReactNode})=>children,
  // Adapter-only tests. Real virtualized DOM, workers and geometry are verified by browser scenarios.
  CodeView:(props:CodeViewProps<ReviewComment,undefined> & {ref:{current:Partial<CodeViewHandle<ReviewComment,undefined>>}})=>{
    props.ref.current={scrollTo,clearSelectedLines};
    received(props);
    return <div>{props.items?.map(item=><div key={item.id}>{props.renderCustomHeader?.(item)}</div>)}</div>;
  },
}));
const files:ChangedFile[]=["first.ts","last.ts"].map(path=>({path,status:"M",patch:"@@ -1 +1 @@\n-old\n+new\n",binary:false,added:1,removed:1}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it("uses the multi-file virtualized surface and navigates without replacing its items",()=>{
  render(<MantineProvider><DiffStream files={files}/></MantineProvider>);
  fireEvent.click(screen.getByRole("button",{name:"last.ts"}));
  expect(scrollTo).toHaveBeenCalledWith({type:"item",id:"last.ts",align:"start",behavior:"instant"});
  expect(screen.getByRole("button",{name:"last.ts"}).getAttribute("aria-pressed")).toBe("true");
  const props=received.mock.calls.at(-1)![0] as CodeViewProps<ReviewComment,undefined>;
  expect(props.items?.map(item=>item.id)).toEqual(["first.ts","last.ts"]);
  expect(props.options?.overflow).toBe("wrap");
});
it("publishes versioned collapsed state and preserves deleted counts",()=>{
  render(<MantineProvider><DiffStream files={[{...files[0]!,status:"D"}]}/></MantineProvider>);
  let props=received.mock.calls.at(-1)![0] as CodeViewProps<ReviewComment,undefined>;
  const firstVersion=props.items?.[0]?.version;
  expect(props.items?.[0]?.collapsed).toBe(true);
  expect(screen.getByText("−1")).toBeTruthy();

  fireEvent.click(screen.getByRole("button",{name:"Expand first.ts"}));

  props=received.mock.calls.at(-1)![0] as CodeViewProps<ReviewComment,undefined>;
  expect(props.items?.[0]?.collapsed).toBe(false);
  expect(props.items?.[0]?.version).toBeGreaterThan(firstVersion!);
});
it("changes wrapping without rebuilding parsed file metadata",()=>{
  const view=render(<MantineProvider><DiffStream files={files}/></MantineProvider>);
  const original=(received.mock.calls.at(-1)![0] as CodeViewProps<ReviewComment,undefined>).items?.[0];
  view.rerender(<MantineProvider><DiffStream files={files} wrap={false}/></MantineProvider>);
  const props=received.mock.calls.at(-1)![0] as CodeViewProps<ReviewComment,undefined>;
  expect(props.options?.overflow).toBe("scroll");
  expect(props.items?.[0]).toBe(original);
});
it("keeps explicit binary and metadata placeholders",()=>{
  render(<MantineProvider><DiffStream files={[{...files[0]!,binary:true},{...files[1]!,patch:"old mode 100644\nnew mode 100755"}]}/></MantineProvider>);
  expect(screen.getByText("Binary file changed. No text diff available.")).toBeTruthy();
  expect(screen.getByText("File metadata changed.")).toBeTruthy();
});
