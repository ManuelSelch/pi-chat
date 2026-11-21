import React from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import { Agentation } from "agentation";
import "@mantine/core/styles.css";
import "./styles.css";
import { App } from "./App";
createRoot(document.getElementById("root")!).render(<MantineProvider theme={createTheme({ fontFamily: "Inter, system-ui, sans-serif", primaryColor: "blue" })}><App />{import.meta.env.DEV && <Agentation />}</MantineProvider>);
