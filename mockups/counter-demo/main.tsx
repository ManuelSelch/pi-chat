import { createRoot } from "react-dom/client";
import { createTheme, MantineProvider } from "@mantine/core";
import { Agentation } from "agentation";
import "@mantine/core/styles.css";
import { CounterDemo } from "./CounterDemo";
import "./styles.css";

const theme = createTheme({
  primaryColor: "blue", defaultRadius: "sm",
  fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  colors: { blue: ["#eef1f5", "#dce2e9", "#c5ceda", "#afbccc", "#9cacc0", "#8b9baf", "#8b9baf", "#76879c", "#65758a", "#536378"] },
});
createRoot(document.getElementById("root")!).render(
  <MantineProvider theme={theme} forceColorScheme="dark" cssVariablesResolver={() => ({
    variables: {}, light: {}, dark: {
      "--mantine-color-body": "#18191e", "--mantine-color-text": "#e5e5ed",
      "--mantine-color-dimmed": "#999aa9", "--mantine-color-default": "#202127",
      "--mantine-color-default-hover": "#282933", "--mantine-color-default-border": "#30313b",
      "--mantine-primary-color-contrast": "#18191e",
    },
  })}>
    <CounterDemo />
    {import.meta.env.DEV && <Agentation />}
  </MantineProvider>,
);
