import { useMemo, type ReactNode } from "react";
import { diffViewerPlugin } from "@manuelselch/pi-plugin-diff-viewer";
import { chimesPlugin } from "@manuelselch/pi-plugin-chimes";
import { folderOpeningPlugin } from "@manuelselch/pi-plugin-folder-opening";
import type { PluginUIHost } from "@manuelselch/pi-sdk/plugins";
import { useAppController } from "../AppControllerContext.js";
import { useComposerFocusReturn } from "../../hooks/composer-focus.js";
import { PluginProvider } from "./PluginProvider.js";

import { loadPluginUIs } from "./load-plugin-ui.js";

const plugins = await loadPluginUIs([folderOpeningPlugin, chimesPlugin, diffViewerPlugin]);

/** Explicit browser registration and implementations of the shell capabilities. */
export function RegisteredPlugins({ children }: { children: ReactNode }) {
  const chat = useAppController();
  const sessions = useMemo(() => chat.app.tabs.map(({ sessionId, status }) => ({ sessionId, status })), [chat.app.tabs]);
  const host = useMemo<PluginUIHost>(() => ({
    sessions,
    connected: chat.app.connection === "open",
    projectPath: chat.state.projectPath || undefined,
    request: chat.request,
    createSession: chat.createAndFocusSession,
    useOverlayFocus: useComposerFocusReturn,
  }), [sessions, chat.app.connection, chat.state.projectPath, chat.request, chat.createAndFocusSession]);
  return <PluginProvider plugins={plugins} host={host}>{children}</PluginProvider>;
}
