// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { Modal, useMantineTheme } from "@mantine/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionThemeProvider } from "../../../../../src/web/app/theme/SessionThemeProvider.js";
import { themeData } from "../../../../infra/v2-fixtures.js";

const key = "pi-chat:lastTheme";
function Probe() {
  const theme = useMantineTheme();
  return <Modal opened onClose={() => {}} title="Remembered theme">{theme.colors.blue[6]}</Modal>;
}
function mount(palette?: ReturnType<typeof themeData>) {
  return render(<SessionThemeProvider palette={palette}><Probe /></SessionThemeProvider>);
}
function shouldUse(palette: ReturnType<typeof themeData>) {
  expect(document.documentElement.dataset.mantineColorScheme).toBe(palette.appearance);
  expect(screen.getByRole("dialog").textContent).toContain(palette.colors.accent);
}
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("remembers the selected palette for Home and restores it after remount", () => {
  const palette = { ...themeData(), appearance: "light" as const };
  const view = mount(palette);
  shouldUse(palette);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(palette);
  view.rerender(<SessionThemeProvider><Probe /></SessionThemeProvider>);
  shouldUse(palette);
  view.unmount();
  mount();
  shouldUse(palette);
});

it("a selected runtime overrides and replaces the stored palette", () => {
  const remembered = themeData();
  localStorage.setItem(key, JSON.stringify(remembered));
  const selected = { ...themeData(), appearance: "light" as const,
    colors: { ...themeData().colors, accent: "#654321" } };
  mount(selected);
  shouldUse(selected);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(selected);
});

it.each(["invalid JSON", "null", "{}", JSON.stringify({ ...themeData(), colors: { ...themeData().colors, accent: "url(evil)" } })])(
  "ignores malformed stored palettes (%s)", value => {
    localStorage.setItem(key, value);
    mount();
    expect(screen.getByRole("dialog").textContent).not.toContain(themeData().colors.accent);
    const styles = [...document.querySelectorAll("style[data-mantine-styles]")].map(el => el.textContent).join("\n");
    expect(styles).not.toContain("--pi-user-bg");
  },
);

it.each(["getItem", "setItem"] as const)("keeps appearance in memory when storage %s throws", method => {
  vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error("Storage unavailable"); });
  const palette = themeData();
  const view = mount(palette);
  view.rerender(<SessionThemeProvider><Probe /></SessionThemeProvider>);
  shouldUse(palette);
});
