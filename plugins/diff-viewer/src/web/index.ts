import { definePlugin, type PluginUI } from "@manuelselch/pi-sdk/plugins";
import { IconGitCompare } from "@tabler/icons-react";
import { createElement, type ReactNode } from "react";
import { diffViewerContract } from "../contract.js";
import { DiffViewerProvider } from "./stores/DiffViewerProvider.js";
import { DiffViewerContainer } from "./components/DiffViewerContainer.js";

export const diffViewerUI: PluginUI<ReactNode> = {
  Provider: DiffViewerProvider,
  contributions: [{
    id:"diff-viewer.changes",
    placement:"side-panel",
    available:context=>context.view==="transcript",
    label:"Changes",
    Icon:()=>createElement(IconGitCompare,{size:16}),
    Component:DiffViewerContainer
  }],
};

export const diffViewerPlugin = definePlugin({
  id:"diff-viewer",
  provides:[diffViewerContract],
  web:()=>diffViewerUI,
});

export * from "../contract.js";
