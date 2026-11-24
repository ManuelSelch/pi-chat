import { expect, it } from "vitest";
import { parsePatch } from "../../../domain/parse-patch.js";
import { highlightPatch } from "../highlight-patch.js";

it("keeps old and new multiline token state separate and prefers new context",()=>{
  const lines = parsePatch("@@ -1,3 +1,3 @@\n-/*\n+const value = 1;\n shared();\n-*/\n+const other = 2;\n");
  const tokens = highlightPatch("src/example.ts",lines);

  expect(tokens[1]!.some(segment=>segment.classes.includes("hljs-comment"))).toBe(true);
  expect(tokens[2]!.some(segment=>segment.classes.includes("hljs-keyword"))).toBe(true);
  expect(tokens[3]!.some(segment=>segment.classes.includes("hljs-comment"))).toBe(false);
  expect(tokens[4]!.some(segment=>segment.classes.includes("hljs-comment"))).toBe(true);
  expect(tokens[5]!.some(segment=>segment.classes.includes("hljs-keyword"))).toBe(true);
});

it("preserves multiline comments across context and added lines",()=>{
  const lines = parsePatch("@@ -1,3 +1,4 @@\n /* start\n+ added comment\n  continued\n  */\n");
  const tokens = highlightPatch("example.js",lines);

  expect(tokens[2]!.map(segment=>segment.text).join("")).toBe(" added comment");
  expect(tokens[2]!.every(segment=>segment.classes.includes("hljs-comment"))).toBe(true);
  expect(tokens[3]!.every(segment=>segment.classes.includes("hljs-comment"))).toBe(true);
});

it("resets token state at hunk boundaries rather than inventing missing context",()=>{
  const lines = parsePatch("@@ -1 +1 @@\n+/* unclosed\n@@ -20 +20 @@\n+const value = 1;\n");
  const tokens = highlightPatch("example.ts",lines);

  expect(tokens[1]!.some(segment=>segment.classes.includes("hljs-comment"))).toBe(true);
  expect(tokens[3]!.some(segment=>segment.classes.includes("hljs-keyword"))).toBe(true);
});

it.each(["unknown.xyz","notes.txt","image.png","Dockerfile","file.__proto__","file.constructor"])("keeps unsupported %s plain",path=>{
  const lines = parsePatch("@@ -0,0 +1 @@\n+const value = 1;\n");

  expect(highlightPatch(path,lines)).toEqual(lines.map(line=>[{text:line.text,classes:[]}]));
});

it.each([
  ["src/example.TSX","const value = 1;"],
  ["src/example.py","def example():"],
  ["Makefile","all: build"],
  ["example.json",'{"name": "value"}'],
  ["example.html",'<div class="value">text</div>'],
])("detects language for %s",(path,source)=>{
  const lines = parsePatch("@@ -0,0 +1 @@\n+"+source+"\n");
  const segments = highlightPatch(path,lines)[1]!;

  expect(segments.map(segment=>segment.text).join("")).toBe(source);
  expect(segments.some(segment=>segment.classes.length>0)).toBe(true);
});

it("preserves tabs, blank lines, metadata and unterminated code exactly",()=>{
  const lines = parsePatch('@@ -1,2 +1,3 @@\n-\tconst before = "unterminated\n+\tconst after = "<script>";\n+\n context\n\\ No newline at end of file\n');
  const tokens = highlightPatch("example.ts",lines);

  expect(tokens.map(segments=>segments.map(segment=>segment.text).join(""))).toEqual(lines.map(line=>line.text));
  expect(tokens[0]!.every(segment=>segment.classes.length===0)).toBe(true);
  expect(tokens.at(-1)!.every(segment=>segment.classes.length===0)).toBe(true);
});

it("does not invent tokens for empty patches",()=>{
  expect(highlightPatch("example.ts",[])).toEqual([]);
});
