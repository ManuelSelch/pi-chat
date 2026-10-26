import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from "@mantine/core";
import type { SessionTheme } from "@manuelselch/pi-sdk";

/** Only missing interaction colors are derived; shade 6 is the exact Pi anchor. */
function mix(color: string, target: string, amount: number): string {
  const channels = [1, 3, 5].map(offset => Math.round(
    parseInt(color.slice(offset, offset + 2), 16) * (1 - amount)
    + parseInt(target.slice(offset, offset + 2), 16) * amount,
  ).toString(16).padStart(2, "0"));
  return `#${channels.join("")}`;
}
function shades(color: string): MantineColorsTuple {
  return Array.from({ length: 10 }, (_, index) => index === 6 ? color
    : index < 6 ? mix(color, "#ffffff", (6 - index) / 7)
      : mix(color, "#000000", (index - 6) / 5)) as unknown as MantineColorsTuple;
}
function contrast(color: string): string {
  const linear = [1, 3, 5].map(offset => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

/** Adapt validated SDK data, never raw theme expressions or arbitrary CSS. */
export function piMantineTheme(palette: SessionTheme) {
  const c = palette.colors;
  const s = palette.surfaces;
  // Reuse the shared vocabulary, including direct Mantine named-color props.
  const anchors = { blue: c.accent, gray: c.muted, green: c.success, yellow: c.warning, red: c.error, teal: c.mdLink };
  const hover = mix(s.cardBg, c.text, 0.08);
  const variables: Record<string, string> = {
    "--mantine-color-body": s.pageBg,
    "--mantine-color-default": s.cardBg,
    "--mantine-color-default-hover": hover,
    "--mantine-color-default-color": c.text,
    "--mantine-color-text": c.text,
    "--mantine-color-bright": c.text,
    "--mantine-color-dimmed": c.muted,
    "--mantine-color-placeholder": c.muted,
    "--mantine-color-default-border": c.border,
    "--mantine-color-anchor": c.mdLink,
    "--mantine-color-error": c.error,
    "--mantine-color-success": c.success,
    "--mantine-color-disabled": mix(s.cardBg, c.muted, 0.12),
    "--mantine-color-disabled-color": mix(s.cardBg, c.muted, 0.65),
    "--mantine-color-disabled-border": c.border,
    "--mantine-primary-color-contrast": contrast(c.accent),
    "--pi-selected-bg": c.selectedBg,
    "--pi-user-bg": c.userMessageBg,
    "--pi-user-text": c.userMessageText,
    "--pi-thinking-text": c.thinkingText,
    "--pi-diff-added": c.toolDiffAdded,
    "--pi-diff-removed": c.toolDiffRemoved,
    "--pi-info-bg": s.infoBg,
  };
  for (const [name, anchor] of Object.entries(anchors)) {
    Object.assign(variables, {
      [`--mantine-color-${name}-filled`]: anchor,
      [`--mantine-color-${name}-filled-hover`]: mix(anchor, c.text, 0.12),
      [`--mantine-color-${name}-light`]: mix(s.cardBg, anchor, 0.15),
      [`--mantine-color-${name}-light-hover`]: mix(s.cardBg, anchor, 0.23),
      [`--mantine-color-${name}-light-color`]: anchor,
      [`--mantine-color-${name}-outline`]: anchor,
      [`--mantine-color-${name}-outline-hover`]: mix(s.cardBg, anchor, 0.12),
      [`--mantine-color-${name}-text`]: anchor,
      [`--mantine-color-${name}-contrast`]: contrast(anchor),
    });
  }
  variables["--mantine-color-teal-light"] = s.infoBg;
  // Mantine components also read these neutral shades directly (inputs, shell,
  // menus). Keep their surfaces within the Pi palette in either appearance.
  const neutral = [c.text, c.text, c.muted, c.muted, c.border, hover, s.cardBg, s.pageBg, s.infoBg, s.pageBg] as MantineColorsTuple;
  const cssVariablesResolver: CSSVariablesResolver = () => ({ variables: {}, light: variables, dark: variables });
  return {
    forceColorScheme: palette.appearance,
    theme: createTheme({ primaryColor: "blue", primaryShade: 6, autoContrast: true, luminanceThreshold: 0.179,
      colors: { ...Object.fromEntries(Object.entries(anchors).map(([name, color]) => [name, shades(color)])),
        dark: neutral,
        gray: [hover, s.cardBg, hover, c.border, c.border, c.muted, c.muted, c.text, c.text, c.text],
      },
    }),
    cssVariablesResolver,
  };
}
