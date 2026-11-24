// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DiffRendererBoundary } from "../DiffRendererBoundary.js";
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it("keeps complete raw patches readable if the renderer throws",()=>{
  vi.spyOn(console,"error").mockImplementation(()=>{});
  function Broken():never {throw new Error("renderer failed");}
  const patch="@@ -1 +1 @@\n-old\n+<script>alert(1)</script>\n";
  render(<DiffRendererBoundary files={[{path:"test.ts",patch,status:"M",binary:false,added:1,removed:1}]}><Broken/></DiffRendererBoundary>);
  expect(screen.getByRole("alert").textContent).toContain("complete plain patches");
  const section=screen.getByRole("region",{name:"Diff for test.ts"});
  expect(section.querySelector("pre")?.textContent).toBe(patch);
  expect(section.querySelector("script")).toBeNull();
});
