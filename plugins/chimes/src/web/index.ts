import { definePlugin, type PluginUI } from "@manuelselch/pi-sdk/plugins";
import type { ReactNode } from "react";
import { ChimesProvider } from "./stores/ChimesProvider.js";
import { ChimesToggleContainer } from "./components/ChimesToggleContainer.js";

export const chimesUI = {
  Provider: ChimesProvider,
  contributions: [{
    id: "chimes.enabled",
    placement: "settings.feature-toggles",
    Component: ChimesToggleContainer,
  }],
} satisfies PluginUI<ReactNode>;

/** Browser-only; importing the declaration does not create an audio context. */
export const chimesPlugin = definePlugin({ id: "chimes", web: () => chimesUI });
