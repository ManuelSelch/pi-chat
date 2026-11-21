import React from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";
import "katex/dist/katex.min.css";
import "./styles.css";
import { App } from "./App";
if (import.meta.env.DEV) await import("react-grab");
createRoot(document.getElementById("root")!).render(<React.StrictMode><MantineProvider forceColorScheme="dark" theme={createTheme({primaryColor:"blue", defaultRadius:"md", fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'})}><App /></MantineProvider></React.StrictMode>);
