import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { SessionTheme } from "@manuelselch/pi-sdk";

/** Actual Pi JSON file + actual Pi loader; only isolated harness resources change. */
export async function themeFixture(root: string, palette: SessionTheme): Promise<Theme> {
  const directory = new URL("modes/interactive/theme/", import.meta.resolve("@earendil-works/pi-coding-agent"));
  const base = JSON.parse(readFileSync(new URL("dark.json", directory), "utf8"));
  const colors = Object.fromEntries(Object.keys(base.colors).map(role => [role, "#777777"]));
  Object.assign(colors, palette.colors);
  mkdirSync(root, { recursive: true });
  const path = join(root, "browser-theme.json");
  writeFileSync(path, JSON.stringify({ name: palette.name, appearance: palette.appearance, colors, export: palette.surfaces }));
  const { loadThemeFromPath } = await import(new URL("theme.js", directory).href) as { loadThemeFromPath(path: string, mode: "truecolor"): Theme };
  return loadThemeFromPath(path, "truecolor");
}
