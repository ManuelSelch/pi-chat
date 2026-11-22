// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { PluginProvider } from "../PluginProvider.js";
import { SidePanelProvider, SidePanelToggle, PluginSidePanel } from "../SidePanelProvider.js";
import { host } from "./plugin-fixture.js";

afterEach(cleanup);
it("composes generic panel tabs, does not block the composer and removes its toggle without contributions",()=>{
  const plugins = [{id:"example",ui:{Provider:({children}:{children:React.ReactNode})=>children,contributions:[
    {id:"example.one",placement:"side-panel" as const,label:"One",Icon:()=>null,Component:()=> <div>First content</div>},
    {id:"example.two",placement:"side-panel" as const,label:"Two",Icon:()=>null,Component:()=> <div>Second content</div>},
  ]}}];
  const content = (registered=plugins)=><MantineProvider><PluginProvider plugins={registered} host={host}><SidePanelProvider><SidePanelToggle/><textarea aria-label="Composer"/><PluginSidePanel/></SidePanelProvider></PluginProvider></MantineProvider>;
  const view = render(content());

  fireEvent.click(screen.getByRole("button",{name:"Toggle side panel"}));
  expect(screen.getByText("First content")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab",{name:"Two"}));
  expect(screen.getByText("Second content")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox",{name:"Composer"}),{target:{value:"Still usable"}});
  expect((screen.getByRole("textbox",{name:"Composer"}) as HTMLTextAreaElement).value).toBe("Still usable");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Close side panel"}));
  expect(screen.queryByRole("complementary",{name:"Side panel"})).toBeNull();
  view.rerender(content([]));
  expect(screen.queryByRole("button",{name:"Toggle side panel"})).toBeNull();
});
