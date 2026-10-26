/**
 * Shared application color vocabulary.
 *
 * Mantine component props need palette names (for example, `color="red"`),
 * while custom styles need resolved CSS values. Keep both forms here so
 * components do not invent their own colors.
 */
export const MANTINE_COLOR = {
  primary: "blue",
  neutral: "gray",
  success: "green",
  warning: "yellow",
  danger: "red",
  info: "teal",
} as const;

export const THEME = {
  colors: MANTINE_COLOR,

  surface: {
    page: "var(--mantine-color-body)",
    panel: "var(--mantine-color-default)",
    panelHover: "var(--mantine-color-default-hover)",
    selected: "var(--pi-selected-bg, var(--mantine-color-default-hover))",
    code: "var(--mantine-color-default)",
  },

  message: {
    background: "var(--pi-user-bg, var(--mantine-color-default-hover))",
    text: "var(--pi-user-text, var(--mantine-color-text))",
  },

  accent: {
    primary: "var(--mantine-primary-color-filled)",
  },

  text: {
    primary: "var(--mantine-color-text)",
    muted: "var(--mantine-color-dimmed)",
    link: "var(--mantine-color-anchor)",
  },

  border: {
    default: "var(--mantine-color-default-border)",
  },

  diff: {
    addition: "var(--pi-diff-added, var(--mantine-color-green-light))",
    removal: "var(--pi-diff-removed, var(--mantine-color-red-light))",
  },

  status: {
    idle: "var(--mantine-color-green-6)",
    running: "var(--mantine-color-yellow-6)",
    blocked: "var(--mantine-color-red-6)",
    success: "var(--mantine-color-green-6)",
    warning: "var(--mantine-color-yellow-6)",
    error: "var(--mantine-color-red-6)",
    info: MANTINE_COLOR.info,
  },
} as const;

/** Colors for the session status indicator in the tab bar. */
export const STATUS_COLOR = {
  idle: THEME.status.idle,
  running: THEME.status.running,
  blocked: THEME.status.blocked,
} as const;
