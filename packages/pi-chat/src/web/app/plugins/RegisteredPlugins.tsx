import { useMemo, type ReactNode } from "react";
import { folderOpeningPlugin } from "@manuelselch/pi-plugin-folder-opening";
import type { PluginUIHost } from "@manuelselch/pi-sdk/plugins";
import { useAppController } from "../AppControllerContext.js";
import { useComposerFocusReturn } from "../../hooks/composer-focus.js";
import { PluginProvider } from "./PluginProvider.js";

import { loadPluginUIs } from "./load-plugin-ui.js";

const plugins = await loadPluginUIs([folderOpeningPlugin]);

/** Explicit browser registration and implementations of the shell capabilities. */
export function RegisteredPlugins({ children }: { children: ReactNode }) {
  const chat = useAppController();
  const host = useMemo<PluginUIHost>(() => ({
    connected: chat.app.connection === "open",
    projectPath: chat.state.projectPath || undefined,
    request: chat.request,
    createSession: chat.createAndFocusSession,
    useOverlayFocus: useComposerFocusReturn,
  }), [chat.app.connection, chat.state.projectPath, chat.request, chat.createAndFocusSession]);
  return <PluginProvider plugins={plugins} host={host}>{children}</PluginProvider>;
}
