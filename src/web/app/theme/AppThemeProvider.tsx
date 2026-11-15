import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { nightShiftTheme, nightShiftVariables } from "./night-shift-theme.js";

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return <MantineProvider forceColorScheme="dark" theme={nightShiftTheme} cssVariablesResolver={nightShiftVariables}>{children}</MantineProvider>;
}
