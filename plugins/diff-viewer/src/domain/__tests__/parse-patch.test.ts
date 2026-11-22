import { expect, it } from "vitest";
import { parsePatch } from "../parse-patch.js";

it("numbers additions, removals and context across hunks", () => {
  const lines = parsePatch("diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -2,2 +2,2 @@\n context\n-old\n+new\n@@ -9,0 +10 @@\n+last\n\\ No newline at end of file\n");

  expect(lines).toEqual([
    {kind:"hunk",text:"@@ -2,2 +2,2 @@",old:null,next:null},
    {kind:"context",text:"context",old:2,next:2},
    {kind:"remove",text:"old",old:3,next:null},
    {kind:"add",text:"new",old:null,next:3},
    {kind:"hunk",text:"@@ -9,0 +10 @@",old:null,next:null},
    {kind:"add",text:"last",old:null,next:10},
    {kind:"note",text:"\\ No newline at end of file",old:null,next:null},
  ]);
});
it("does not confuse content resembling patch headers with metadata", () => {
  expect(parsePatch("@@ -1 +1 @@\n--- old\n+++ new\n").map(line=>line.kind)).toEqual(["hunk","remove","add"]);
});
it("does not invent lines for binary or mode-only changes", () => {
  expect(parsePatch("old mode 100644\nnew mode 100755\n")).toEqual([]);
});
