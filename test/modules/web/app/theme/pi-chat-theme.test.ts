import { expect, it } from "vitest";
import { DEFAULT_THEME, mergeMantineTheme } from "@mantine/core";
import { piChatTheme, piChatVariables } from "../../../../../src/web/app/theme/pi-chat-theme.js";
import { STATUS_COLOR, THEME } from "../../../../../src/web/ui/theme.js";

const theme = mergeMantineTheme(DEFAULT_THEME, piChatTheme);
const vars = piChatVariables(theme).dark;

it("matches the approved AppTheme surfaces, text, accent and diffs", () => {
  expect(vars).toMatchObject({
    "--mantine-color-body": "#18191e",
    "--mantine-color-default": "#202127",
    "--pi-sidebar-bg": "#141519",
    "--mantine-color-text": "#e5e5ed",
    "--mantine-color-dimmed": "#999aa9",
    "--mantine-color-default-border": "#30313b",
    "--mantine-color-default-hover": "#282933",
    "--mantine-color-blue-filled": "#8b9baf",
    "--pi-selected-bg": "#292f38",
    "--pi-diff-added": "#7bbda4",
    "--pi-diff-removed": "#eb969b",
  });
});

it("uses red blocked, green ready, orange working and gray later indicators", () => {
  expect(STATUS_COLOR).toEqual({
    idle: "var(--mantine-color-green-6)",
    running: "var(--mantine-color-orange-6)",
    blocked: "var(--mantine-color-red-6)",
  });
  expect(THEME.status.later).toBe("var(--pi-status-later)");
  expect(vars["--pi-status-later"]).toBe("#80818f");
  expect(theme.colors.red[6]).toBe("#f08080");
  expect(theme.colors.green[6]).toBe("#7bbda4");
  expect(theme.colors.orange[6]).toBe("#e8a05b");
});

it("themes named controls, hover states and primary labels with readable contrast", () => {
  expect(theme.primaryColor).toBe("blue");
  expect(theme.primaryShade).toBe(6);
  expect(vars["--mantine-primary-color-contrast"]).toBe("#18191e");
  for (const name of ["blue", "violet", "green", "red", "orange", "yellow", "teal", "gray"]) {
    expect(theme.colors[name]).toHaveLength(10);
    expect(vars[`--mantine-color-${name}-filled`]).toBe(theme.colors[name]![6]);
    expect(vars[`--mantine-color-${name}-filled-hover`]).not.toBe(vars[`--mantine-color-${name}-filled`]);
    expect(vars[`--mantine-color-${name}-light-hover`]).not.toBe(vars[`--mantine-color-${name}-light`]);
  }
});
