import { useMemo, type ReactNode } from "react";
import { folderOpeningWebPlugin } from "@manuelselch/pi-plugin-folder-opening/web";
import type { WebPluginHost } from "@manuelselch/pi-sdk/plugins";
import { useAppController } from "../AppControllerContext.js";
import { useComposerFocusReturn } from "../../hooks/composer-focus.js";
import { PluginProvider } from "./PluginProvider.js";

const plugins = [folderOpeningWebPlugin];

/** Explicit browser registration and implementations of the shell capabilities. */
export function RegisteredPlugins({ children }: { children: ReactNode }) {
  const chat = useAppController();
  const host = useMemo<WebPluginHost>(() => ({
    connected: chat.app.connection === "open",
    projectPath: chat.state.projectPath || undefined,
    request: chat.request,
    createSession: chat.createAndFocusSession,
    useOverlayFocus: useComposerFocusReturn,
  }), [chat.app.connection, chat.state.projectPath, chat.request, chat.createAndFocusSession]);
  return <PluginProvider plugins={plugins} host={host}>{children}</PluginProvider>;
}
