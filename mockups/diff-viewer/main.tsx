import React from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import { Agentation } from "agentation";
import "@mantine/core/styles.css";
import { DiffViewerMockup } from "./DiffViewerMockup";
import "./styles.css";

const theme = createTheme({
  primaryColor: "gray", defaultRadius: "sm",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMonospace: '"SFMono-Regular", Consolas, monospace',
  colors: { dark: ["#e5e5ed", "#e5e5ed", "#999aa9", "#999aa9", "#30313b", "#282933", "#202127", "#18191e", "#141519", "#141519"] },
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode><MantineProvider theme={theme} forceColorScheme="dark">
    <DiffViewerMockup />
    {import.meta.env.DEV && <Agentation />}
  </MantineProvider></React.StrictMode>,
);
