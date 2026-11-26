import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from "@mantine/core";

/** Fixed application palette from the approved mockup. Not a runtime Pi theme. */
export const PI_CHAT_THEME_COLORS = {
  page: "#18191e",
  panel: "#202127",
  sidebar: "#141519",
  text: "#e5e5ed",
  muted: "#999aa9",
  border: "#30313b",
  hover: "#282933",
  accent: "#8b9baf",
  selected: "#292f38",
  ready: "#7bbda4",
  blocked: "#f08080",
  working: "#e8a05b",
  later: "#80818f",
  removed: "#eb969b",
} as const;

function mix(color: string, target: string, amount: number): string {
  const channels = [1, 3, 5].map(offset => Math.round(
    Number.parseInt(color.slice(offset, offset + 2), 16) * (1 - amount)
    + Number.parseInt(target.slice(offset, offset + 2), 16) * amount,
  ).toString(16).padStart(2, "0"));
  return `#${channels.join("")}`;
}
function shades(anchor: string): MantineColorsTuple {
  return Array.from({ length: 10 }, (_, index) => index === 6 ? anchor
    : index < 6 ? mix(anchor, "#ffffff", (6 - index) / 7)
      : mix(anchor, "#000000", (index - 6) / 5)) as unknown as MantineColorsTuple;
}

const c = PI_CHAT_THEME_COLORS;
// Existing named-color props retain their semantic meaning; blue is the app's
// primary vocabulary, now slate blue. Orange is the running-session indicator.
const anchors = { blue: c.accent, violet: c.accent, green: c.ready, red: c.blocked, orange: c.working, yellow: c.working, teal: c.accent, gray: c.muted };
const variables: Record<string, string> = {
  "--mantine-color-body": c.page,
  "--mantine-color-default": c.panel,
  "--mantine-color-default-hover": c.hover,
  "--mantine-color-default-color": c.text,
  "--mantine-color-text": c.text,
  "--mantine-color-bright": c.text,
  "--mantine-color-dimmed": c.muted,
  "--mantine-color-placeholder": c.muted,
  "--mantine-color-default-border": c.border,
  "--mantine-color-anchor": c.accent,
  "--mantine-color-error": c.blocked,
  "--mantine-color-success": c.ready,
  "--mantine-color-disabled": c.hover,
  "--mantine-color-disabled-color": c.later,
  "--mantine-color-disabled-border": c.border,
  "--mantine-primary-color-contrast": c.page,
  "--pi-sidebar-bg": c.sidebar,
  "--pi-selected-bg": c.selected,
  "--pi-user-bg": c.hover,
  "--pi-user-text": c.text,
  "--pi-thinking-text": c.muted,
  "--pi-diff-added": c.ready,
  "--pi-diff-removed": c.removed,
  "--pi-info-bg": c.selected,
  "--pi-status-later": c.later,
};
for (const [name, anchor] of Object.entries(anchors)) {
  Object.assign(variables, {
    [`--mantine-color-${name}-filled`]: anchor,
    [`--mantine-color-${name}-filled-hover`]: mix(anchor, c.text, 0.12),
    [`--mantine-color-${name}-light`]: name === "blue" || name === "violet" ? c.selected : mix(c.panel, anchor, 0.15),
    [`--mantine-color-${name}-light-hover`]: mix(c.panel, anchor, 0.23),
    [`--mantine-color-${name}-light-color`]: anchor,
    [`--mantine-color-${name}-outline`]: anchor,
    [`--mantine-color-${name}-outline-hover`]: mix(c.panel, anchor, 0.12),
    [`--mantine-color-${name}-text`]: anchor,
    [`--mantine-color-${name}-contrast`]: c.page,
  });
}

export const piChatTheme = createTheme({
  primaryColor: "blue",
  primaryShade: 6,
  autoContrast: true,
  luminanceThreshold: 0.179,
  colors: {
    ...Object.fromEntries(Object.entries(anchors).map(([name, anchor]) => [name, shades(anchor)])),
    dark: [c.text, c.text, c.muted, c.muted, c.border, c.hover, c.panel, c.page, c.sidebar, c.sidebar],
    gray: [c.hover, c.panel, c.hover, c.border, c.border, c.muted, c.muted, c.text, c.text, c.text],
  },
});

/** Root variables also apply to body portals, before any session opens. */
export const piChatVariables: CSSVariablesResolver = () => ({ variables: {}, light: variables, dark: variables });
