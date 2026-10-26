import { useMemo, type ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import type { SessionTheme } from "@manuelselch/pi-sdk";
import { piMantineTheme } from "./pi-mantine-theme.js";

export function SessionThemeProvider({ palette, children }: { palette?: SessionTheme; children: ReactNode }) {
  const config = useMemo(() => palette ? piMantineTheme(palette) : undefined, [palette]);
  // The provider owns root variables, so body portals inherit the same palette.
  // No persisted scheme, cache or lifecycle requests are introduced here.
  return <MantineProvider defaultColorScheme="auto" {...config}>{children}</MantineProvider>;
}
