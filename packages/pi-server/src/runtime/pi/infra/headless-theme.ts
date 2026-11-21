import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { colorToHex, colorToRgb, indexedColor, parseColor, rgbColor } from "@earendil-works/pi-tui";
import { sessionThemeSchema, type SessionTheme } from "@manuelselch/pi-sdk/protocol";

// Pi does not publicly export its file loader/validator. Resolve this
// compatibility seam from the installed package, not a sibling source checkout.
const themeDirectory = new URL("modes/interactive/theme/", import.meta.resolve("@earendil-works/pi-coding-agent"));
const { loadThemeFromPath, resolveThemeSetting } = await import(new URL("theme.js", themeDirectory).href) as {
  loadThemeFromPath(path: string, mode: "truecolor"): Theme;
  resolveThemeSetting(setting: string | undefined, appearance: "dark"): string | undefined;
};
const { validateThemeJson } = await import(new URL("theme-schema.js", themeDirectory).href) as {
  validateThemeJson(label: string, json: unknown): {
    vars?: Record<string, string | number>;
    export?: Partial<Record<keyof SessionTheme["surfaces"], string | number>>;
  };
};

export interface HeadlessTheme { theme: Theme; palette: SessionTheme }
const roles = ["accent", "text", "muted", "border", "selectedBg", "mdLink", "success", "warning", "error", "userMessageBg", "userMessageText", "thinkingText", "toolDiffAdded", "toolDiffRemoved"] as const;
const backgrounds = new Set(["selectedBg", "searchMatchBg", "userMessageBg", "customMessageBg", "toolPendingBg", "toolSuccessBg", "toolErrorBg"]);

/** Resolve only against Pi's already-discovered (and trust-filtered) resources. */
export function resolveHeadlessTheme(
  setting: string | undefined,
  discovered: readonly Theme[],
  diagnostic: (message: string) => void = message => console.warn(message),
): HeadlessTheme {
  try {
    const name = resolveThemeSetting(setting, "dark");
    if (!name || name === "system") throw new Error("No concrete headless theme selected");
    const resource = discovered.find(theme => theme.name === name);
    const path = resource?.sourcePath ?? (!resource && (name === "dark" || name === "light")
      ? fileURLToPath(new URL(`${name}.json`, themeDirectory)) : undefined);
    if (!path) throw new Error("Selected theme is unavailable");
    return load(path);
  } catch {
    // Do not expose source paths, theme contents or arbitrary error text.
    diagnostic("theme.headless_fallback: using deterministic Pi dark; selected theme is missing, invalid or terminal-dependent.");
    return load(fileURLToPath(new URL("dark.json", themeDirectory)));
  }
}

function load(path: string): HeadlessTheme {
  const json = validateThemeJson(path, JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")));
  const theme = loadThemeFromPath(path, "truecolor");
  // Empty slots inherit the actual terminal, so cannot represent this runtime's
  // concrete palette reliably. Do not mutate Pi's terminal/global theme state.
  for (const token of Object.keys(theme.colors)) {
    const ansi = backgrounds.has(token) ? theme.getBgAnsi(token as Parameters<Theme["getBgAnsi"]>[0]) : theme.getFgAnsi(token as Parameters<Theme["getFgAnsi"]>[0]);
    if (ansi === "\x1b[39m" || ansi === "\x1b[49m") throw new Error("Terminal-dependent theme");
  }
  const colors = Object.fromEntries(roles.map(role => [role, colorToHex(theme.colors[role])]));
  const surfaces = deriveSurfaces(colorToHex(theme.colors.userMessageBg));
  for (const role of Object.keys(surfaces) as (keyof SessionTheme["surfaces"])[]) {
    const explicit = resolveExportColor(json.export?.[role], json.vars ?? {});
    if (explicit !== undefined) surfaces[role] = explicit;
  }
  const palette = sessionThemeSchema.parse({ name: theme.name, appearance: theme.appearance, colors, surfaces });
  // Pi's convenience decorations use TTY-sensitive Chalk; style() does not.
  theme.bold = text => theme.style(text, { bold: true });
  theme.italic = text => theme.style(text, { italic: true });
  theme.underline = text => theme.style(text, { underline: true });
  theme.inverse = text => theme.style(text, { inverse: true });
  theme.strikethrough = text => theme.style(text, { strikethrough: true });
  return { theme, palette };
}

// Adapted from Pi 1.0.2 theme.ts resolveVarRefs/getThemeExportColors (MIT).
// Only export slots need this local adapter; actual theme tokens use Pi's loader.
function resolveExportColor(value: string | number | undefined, vars: Record<string, string | number>): string | undefined {
  const visited = new Set<string>();
  while (typeof value === "string" && value !== "" && !value.startsWith("#") && !/^ok(lch|hsl)\(/i.test(value)) {
    if (visited.has(value) || !Object.hasOwn(vars, value)) throw new Error("Invalid export variable");
    visited.add(value);
    value = vars[value];
  }
  if (value === undefined || value === "") return undefined;
  return colorToHex(typeof value === "number" ? indexedColor(value) : parseColor(value));
}

// Adapted from Pi 1.0.2 core/export-html/index.ts deriveExportColors (MIT).
// Keep Pi's luminance threshold, rounding and channel adjustments exactly.
function deriveSurfaces(base: string): SessionTheme["surfaces"] {
  const { r, g, b } = colorToRgb(parseColor(base));
  const linear = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const light = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) > 0.5;
  const hex = (red: number, green: number, blue: number) => colorToHex(rgbColor(red, green, blue));
  const brightness = (factor: number) => hex(Math.round(r * factor), Math.round(g * factor), Math.round(b * factor));
  return light
    ? { pageBg: brightness(0.96), cardBg: base, infoBg: hex(Math.min(255, r + 10), Math.min(255, g + 5), Math.max(0, b - 20)) }
    : { pageBg: brightness(0.7), cardBg: brightness(0.85), infoBg: hex(Math.min(255, r + 20), Math.min(255, g + 15), b) };
}
