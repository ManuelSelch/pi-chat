import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { piChatTheme, piChatVariables } from "./pi-chat-theme.js";

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return <MantineProvider forceColorScheme="dark" theme={piChatTheme} cssVariablesResolver={piChatVariables}>{children}</MantineProvider>;
}
