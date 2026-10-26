import { expect, it } from "vitest";
import { DEFAULT_THEME, mergeMantineTheme } from "@mantine/core";
import { piMantineTheme } from "../../../../../src/web/app/theme/pi-mantine-theme.js";
import { themeData } from "../../../../infra/v2-fixtures.js";

it.each(["light", "dark"] as const)("maps exact Pi anchors in %s appearance and derives only interaction shades", appearance => {
  const palette = { ...themeData(), appearance };
  const result = piMantineTheme(palette);
  const theme = mergeMantineTheme(DEFAULT_THEME, result.theme);
  const vars = result.cssVariablesResolver(theme)[appearance];
  expect(result.forceColorScheme).toBe(appearance);
  expect(vars).toMatchObject({
    "--mantine-color-body": palette.surfaces.pageBg,
    "--mantine-color-default": palette.surfaces.cardBg,
    "--mantine-color-text": palette.colors.text,
    "--mantine-color-dimmed": palette.colors.muted,
    "--mantine-color-default-border": palette.colors.border,
    "--mantine-color-anchor": palette.colors.mdLink,
    "--pi-selected-bg": palette.colors.selectedBg,
    "--pi-user-bg": palette.colors.userMessageBg,
    "--pi-user-text": palette.colors.userMessageText,
    "--pi-thinking-text": palette.colors.thinkingText,
    "--pi-diff-added": palette.colors.toolDiffAdded,
    "--pi-diff-removed": palette.colors.toolDiffRemoved,
    "--pi-info-bg": palette.surfaces.infoBg,
  });
  for (const [name, anchor] of Object.entries({ blue: "accent", green: "success", yellow: "warning", red: "error", teal: "mdLink", gray: "muted" } as const)) {
    expect(theme.colors[name]).toHaveLength(10);
    expect(theme.colors[name]![6]).toBe(palette.colors[anchor]);
    expect(new Set(theme.colors[name]).size).toBeGreaterThan(1);
    expect(vars[`--mantine-color-${name}-filled`]).toBe(palette.colors[anchor]);
    expect(vars[`--mantine-color-${name}-light-color`]).toBe(palette.colors[anchor]);
  }
});

it("keeps primary labels contrasting without rewriting supplied text or accent", () => {
  const palette = themeData(); palette.colors.accent = "#ffff00";
  const config = piMantineTheme(palette);
  const vars = config.cssVariablesResolver(mergeMantineTheme(DEFAULT_THEME, config.theme)).dark;
  expect(vars["--mantine-color-blue-contrast"]).toBe("#000000");
  expect(vars["--mantine-color-text"]).toBe(palette.colors.text);
  expect(vars["--mantine-color-blue-filled"]).toBe("#ffff00");
});
