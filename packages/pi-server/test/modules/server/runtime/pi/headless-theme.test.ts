import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionThemeSchema } from "@manuelselch/pi-sdk/protocol";
import { resolveHeadlessTheme } from "../../../../../src/runtime/pi/infra/headless-theme.js";

const themeDirectory = new URL("modes/interactive/theme/", import.meta.resolve("@earendil-works/pi-coding-agent"));
const pi = await import(new URL("theme.js", themeDirectory).href);
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function custom(overrides: Record<string, unknown> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "pi-theme-")); dirs.push(dir);
  const path = join(dir, "custom.json");
  const json = { ...JSON.parse(readFileSync(new URL("light.json", themeDirectory), "utf8")), name: "custom", appearance: "light", ...overrides };
  if (overrides.vars) json.vars = { ...JSON.parse(readFileSync(new URL("light.json", themeDirectory), "utf8")).vars, ...overrides.vars as object };
  writeFileSync(path, JSON.stringify(json));
  return { path, json, theme: pi.loadThemeFromPath(path, "truecolor") };
}

describe("headless runtime themes", () => {
  it("uses discovered custom resources and Pi's color resolution without terminal initialization", () => {
    const { theme, json } = custom();
    json.vars = { ...(json.vars ?? {}), brand: "#123456", alias: "brand" };
    json.colors.accent = "alias";
    json.colors.warning = 196;
    json.colors.mdLink = "oklch(70% 0.1 200)";
    json.export = { pageBg: "alias", cardBg: 196, infoBg: "okhsl(120 50% 50%)" };
    writeFileSync(theme.sourcePath, JSON.stringify(json));
    const resolved = resolveHeadlessTheme("custom", [theme]);
    expect(sessionThemeSchema.safeParse(resolved.palette).success).toBe(true);
    expect(resolved.palette.name).toBe("custom");
    expect(resolved.palette.appearance).toBe("light");
    expect(resolved.palette.colors.accent).toBe("#123456");
    expect(resolved.palette.colors.warning).toBe("#ff0000");
    expect(resolved.palette.surfaces.pageBg).toBe("#123456");
    expect(resolved.palette.surfaces.cardBg).toBe("#ff0000");
    expect(resolved.theme.fg("accent", "widget")).toContain("\x1b[38;2;18;52;86m");
    expect(resolved.theme.bold("bold")).toContain("\x1b[1m");
    expect(resolved.theme.getColorMode()).toBe("truecolor");
  });

  it("isolates instances and chooses the dark member of a fixed pair", () => {
    const light = resolveHeadlessTheme("light", []);
    const dark = resolveHeadlessTheme("light/dark", []);
    expect(light.theme).not.toBe(dark.theme);
    expect(light.palette.appearance).toBe("light");
    expect(dark.palette.name).toBe("dark");
    const before = dark.theme.fg("accent", "x");
    light.theme.bold = () => "changed";
    expect(dark.theme.bold("x")).not.toBe("changed");
    expect(dark.theme.fg("accent", "x")).toBe(before);
  });

  it.each([undefined, "system", "missing", "../outside", "light/dark/other"])("falls back deterministically for %s and reports a diagnostic", setting => {
    const diagnostic = vi.fn();
    const actual = resolveHeadlessTheme(setting, [], diagnostic);
    expect(actual.palette).toEqual(resolveHeadlessTheme("dark", []).palette);
    expect(diagnostic).toHaveBeenCalledOnce();
  });

  it("does not discover themes outside the supplied trusted resource list", () => {
    const { theme } = custom();
    const diagnostic = vi.fn();
    expect(resolveHeadlessTheme("custom", [], diagnostic).palette.name).toBe("dark");
    expect(resolveHeadlessTheme("custom", [theme]).palette.name).toBe("custom");
  });

  it("rejects invalid source documents even when a previously loaded resource exists", () => {
    const { theme } = custom();
    writeFileSync(theme.sourcePath, JSON.stringify({ name: "custom", colors: { accent: "#ffffff" } }));
    const diagnostic = vi.fn();
    expect(resolveHeadlessTheme("custom", [theme], diagnostic).palette.name).toBe("dark");
    expect(diagnostic).toHaveBeenCalledOnce();
  });

  it("rejects invalid export variables and names without preventing fallback", () => {
    for (const overrides of [{ export: { pageBg: "missing" } }, { name: "x".repeat(129) }, { export: { pageBg: "a" }, vars: { a: "b", b: "a" } }]) {
      const { theme } = custom(overrides);
      const diagnostic = vi.fn();
      expect(resolveHeadlessTheme(theme.name, [theme], diagnostic).palette.name).toBe("dark");
      expect(diagnostic).toHaveBeenCalledOnce();
    }
  });

  it("derives missing surfaces using Pi's HTML export policy", () => {
    const { theme, json } = custom();
    delete json.export;
    json.colors.userMessageBg = "#646464";
    writeFileSync(theme.sourcePath, JSON.stringify(json));
    expect(resolveHeadlessTheme("custom", [theme]).palette.surfaces).toEqual({ pageBg: "#464646", cardBg: "#555555", infoBg: "#787364" });
    json.colors.userMessageBg = "#f0f0f0";
    writeFileSync(theme.sourcePath, JSON.stringify(json));
    expect(resolveHeadlessTheme("custom", [theme]).palette.surfaces).toEqual({ pageBg: "#e6e6e6", cardBg: "#f0f0f0", infoBg: "#faf5dc" });
  });

  it("falls back for terminal-default slots", () => {
    const { theme, json } = custom();
    json.colors.text = "";
    writeFileSync(theme.sourcePath, JSON.stringify(json));
    const diagnostic = vi.fn();
    expect(resolveHeadlessTheme("custom", [theme], diagnostic).palette.name).toBe("dark");
    expect(diagnostic).toHaveBeenCalledOnce();
  });

  it("matches Pi export variable resolution for a custom theme", () => {
    const { theme, json } = custom();
    json.vars = { ...json.vars, page: "alias", alias: "#123456" };
    json.export = { pageBg: "page", cardBg: 196, infoBg: "okhsl(120 50% 50%)" };
    writeFileSync(theme.sourcePath, JSON.stringify(json));
    // Reference only: production must never register themes globally.
    pi.setRegisteredThemes([theme]);
    try {
      expect(resolveHeadlessTheme("custom", [theme]).palette.surfaces).toEqual(pi.getThemeExportColors("custom"));
    } finally { pi.setRegisteredThemes([]); }
  });

  it("matches Pi export colors for a built-in theme", () => {
    const palette = resolveHeadlessTheme("light", []).palette;
    const exported = pi.getThemeExportColors("light");
    expect(palette.surfaces).toEqual(exported);
    for (const [key, value] of Object.entries(palette.colors)) expect(value).toBe(pi.getResolvedThemeColors("light")[key]);
  });
});
