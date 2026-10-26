import { useMemo, type ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import type { SessionTheme } from "@manuelselch/pi-sdk";
import { piMantineTheme } from "./pi-mantine-theme.js";
import { useRememberedTheme } from "./use-remembered-theme.js";

export function SessionThemeProvider({ palette, children }: { palette?: SessionTheme; children: ReactNode }) {
  const effectivePalette = useRememberedTheme(palette);
  const config = useMemo(() => effectivePalette ? piMantineTheme(effectivePalette) : undefined, [effectivePalette]);
  // Root variables also theme body portals and Home after runtime caches clear.
  return <MantineProvider defaultColorScheme="auto" {...config}>{children}</MantineProvider>;
}
