// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { Modal, useMantineTheme } from "@mantine/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppThemeProvider } from "../../../../../src/web/app/theme/AppThemeProvider.js";
import { themeData } from "../../../../infra/v2-fixtures.js";

function Probe() {
  const theme = useMantineTheme();
  return <Modal opened onClose={() => {}} title="Theme portal">{theme.colors.blue[6]}</Modal>;
}
function shouldUseAppTheme() {
  expect(document.documentElement.dataset.mantineColorScheme).toBe("dark");
  expect(screen.getByRole("dialog").textContent).toContain("#8b9baf");
  const styles = [...document.querySelectorAll("style[data-mantine-styles]")].map(el => el.textContent).join("\n");
  expect(styles).toContain("--mantine-color-body: #18191e");
  expect(styles).toContain("--mantine-color-default: #202127");
  expect(styles).toContain("--mantine-color-text: #e5e5ed");
}
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("uses AppTheme on first visit, including portalled dialogs and after remount", () => {
  const view = render(<AppThemeProvider><Probe /></AppThemeProvider>);
  shouldUseAppTheme();

  view.unmount();
  render(<AppThemeProvider><Probe /></AppThemeProvider>);
  shouldUseAppTheme();
});

it.each([JSON.stringify({ ...themeData(), appearance: "light" }), "invalid JSON"])("ignores old remembered appearance (%s)", value => {
  localStorage.setItem("pi-chat:lastTheme", value);
  localStorage.setItem("mantine-color-scheme-value", "light");
  render(<AppThemeProvider><Probe /></AppThemeProvider>);

  shouldUseAppTheme();
});

it("does not read or write legacy runtime appearance storage, even when storage throws", () => {
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
  render(<AppThemeProvider><Probe /></AppThemeProvider>);

  shouldUseAppTheme();
  expect(read).not.toHaveBeenCalledWith("pi-chat:lastTheme");
  expect(write).not.toHaveBeenCalled();
});
