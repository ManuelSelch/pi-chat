import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("provides a high-resolution Apple touch icon for Add to Dock", () => {
  const html = readFileSync("index.html", "utf8");
  expect(html).toContain('<link rel="apple-touch-icon" sizes="1024x1024" href="/apple-touch-icon.png" />');

  const png = readFileSync("public/apple-touch-icon.png");
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.readUInt32BE(16)).toBe(1024);
  expect(png.readUInt32BE(20)).toBe(1024);
});
