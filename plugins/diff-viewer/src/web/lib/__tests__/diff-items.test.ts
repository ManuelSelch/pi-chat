import { expect, it } from "vitest";
import { prepareFile } from "../diff-items.js";
import type { ChangedFile } from "../../../contract.js";
const file:ChangedFile = {path:"dir/odd \"name\n.ts",status:"M",patch:"@@ -20 +20 @@\n-old\n+new\n",binary:false,added:1,removed:1};
it("preserves partial patch line numbers and exact paths",()=>{
  const {diff}=prepareFile(file);
  expect(diff.name).toBe(file.path);
  expect(diff.hunks[0]?.additionStart).toBe(20);
  expect(diff.additionLines.join("")).toContain("new");
  expect(diff.deletionLines.join("")).toContain("old");
  expect(diff.isPartial).toBe(true);
});
it("retains explicit binary, empty and metadata placeholders",()=>{
  expect(prepareFile({...file,binary:true}).placeholder).toContain("Binary");
  expect(prepareFile({...file,status:"A",patch:""}).placeholder).toBe("Empty file added.");
  expect(prepareFile({...file,status:"D",patch:""}).placeholder).toBe("Empty file deleted.");
  expect(prepareFile({...file,patch:"old mode 100644\nnew mode 100755"}).placeholder).toBe("File metadata changed.");
});
it("bounds syntax highlighting for generated files without truncating lines",()=>{
  const {diff}=prepareFile({...file,patch:"@@ -0,0 +1,2200 @@\n"+Array.from({length:2200},(_,i)=>"+export const generated"+i+" = 1;\n").join("")});
  expect(diff.lang).toBe("text");
  expect(diff.additionLines).toHaveLength(2200);
  expect(diff.additionLines.at(-1)).toContain("generated2199");
});
it("never interprets code as HTML and changes snapshot cache identity on refresh",()=>{
  const first=prepareFile({...file,patch:"@@ -0,0 +1 @@\n+<script>alert(1)</script>\n"});
  expect(first.diff.additionLines[0]).toContain("<script>");
  expect(first.diff.cacheKey).not.toBe(prepareFile(file).diff.cacheKey);
});
