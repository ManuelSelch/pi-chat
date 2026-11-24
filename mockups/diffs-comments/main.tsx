import { createRoot } from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import DiffWorker from "@pierre/diffs/worker/worker.js?worker";
import { Agentation } from "agentation";
import { ReviewMockup } from "./ReviewMockup";
import { diffTheme } from "./theme";
import "@mantine/core/styles.css";
import "./styles.css";

const poolOptions = {workerFactory:()=>new DiffWorker(),poolSize:2};
const highlighterOptions = {theme:diffTheme};
const theme = createTheme({primaryColor:"gray",defaultRadius:"sm",fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',fontFamilyMonospace:'"SFMono-Regular", Consolas, monospace'});
createRoot(document.getElementById("root")!).render(
  <MantineProvider theme={theme} forceColorScheme="dark">
    <WorkerPoolContextProvider poolOptions={poolOptions} highlighterOptions={highlighterOptions}><ReviewMockup/></WorkerPoolContextProvider>
    {import.meta.env.DEV && <Agentation/>}
  </MantineProvider>,
);
