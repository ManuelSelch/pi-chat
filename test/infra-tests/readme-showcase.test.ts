import { describe, expect, it } from "vitest";
import { assembleShowcaseHtml } from "../../scripts/readme-showcase/assembly.js";

describe("README showcase assembly", () => {
  it("embeds all four captures in the approved Product first order", () => {
    const html = assembleShowcaseHtml({ workspace: "AAA", projects: "BBB", switcher: "CCC", light: "DDD" });
    expect([...html.matchAll(/src="data:image\/png;base64,([A-Z]+)"/g)].map(match => match[1])).toEqual(["AAA", "BBB", "CCC", "DDD"]);
    for (const name of ["Workspace", "Projects &amp; sessions", "Quick Switcher", "Light mode"]) expect(html).toContain(name);
    expect(html).not.toMatch(/<header|<footer|https?:\/\//);
    expect(html).not.toContain("Commands Panel");
    expect(html).not.toContain("Real work, without the noise");
    expect(html).not.toContain("A real conversation");
  });

  it("fits the complete Quick Switcher capture without cropping its edges", () => {
    const html = assembleShowcaseHtml({ workspace: "AAA", projects: "BBB", switcher: "CCC", light: "DDD" });
    expect(html).toContain(".grid .switcher img{object-fit:contain;object-position:center}");
  });

  it("rejects malformed image data rather than interpolating markup", () => {
    expect(() => assembleShowcaseHtml({ workspace: '<script>', projects: "BBB", switcher: "CCC", light: "DDD" })).toThrow(/base64/);
  });
});
