import React from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";
import "./styles.css";
import { SettingsMockup } from "./SettingsMockup";
if (import.meta.env.DEV) await import("react-grab");
createRoot(document.getElementById("root")!).render(<React.StrictMode><MantineProvider defaultColorScheme="dark" theme={createTheme({ primaryColor: "blue", defaultRadius: "sm", fontFamily: "system-ui, sans-serif" })}><SettingsMockup /></MantineProvider></React.StrictMode>);
