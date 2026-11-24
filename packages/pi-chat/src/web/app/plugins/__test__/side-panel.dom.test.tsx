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
  const content = (registered=plugins)=><MantineProvider><PluginProvider plugins={registered} host={host}><SidePanelProvider view="transcript"><SidePanelToggle/><textarea aria-label="Composer"/><PluginSidePanel/></SidePanelProvider></PluginProvider></MantineProvider>;
  const view = render(content());

  fireEvent.click(screen.getByRole("button",{name:"Toggle side panel"}));
  expect(screen.getByText("First content")).toBeTruthy();
  expect(screen.getByRole("tab",{name:"One"}).style.borderBottomColor).toBe("");
  fireEvent.click(screen.getByRole("tab",{name:"Two"}));
  expect(screen.getByText("Second content")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox",{name:"Composer"}),{target:{value:"Still usable"}});
  expect((screen.getByRole("textbox",{name:"Composer"}) as HTMLTextAreaElement).value).toBe("Still usable");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("button",{name:"Close side panel"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Toggle side panel"}));
  expect(screen.getByRole("button",{name:"Toggle side panel"}).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("complementary",{name:"Side panel"})).toBeNull();
  view.rerender(content([{...plugins[0]!,ui:{...plugins[0]!.ui,contributions:[plugins[0]!.ui.contributions[0]!]}}]));
  fireEvent.click(screen.getByRole("button",{name:"Toggle side panel"}));
  expect(screen.getByRole("tab",{name:"One"}).style.borderBottomColor).toBe("transparent");
  view.rerender(content([]));
  expect(screen.queryByRole("button",{name:"Toggle side panel"})).toBeNull();
});
it("keeps other panels available when a contextual panel disappears",()=>{
  const plugins = [{id:"example",ui:{Provider:({children}:{children:React.ReactNode})=>children,contributions:[
    {id:"example.transcript",placement:"side-panel" as const,label:"Transcript",Icon:()=>null,Component:()=> <div>Transcript content</div>,available:(context:{view:"home" | "transcript"})=>context.view==="transcript"},
    {id:"example.always",placement:"side-panel" as const,label:"Always",Icon:()=>null,Component:()=> <div>Always content</div>},
  ]}}];
  const content = (view:"home" | "transcript")=><MantineProvider><PluginProvider plugins={plugins} host={host}><SidePanelProvider view={view}><SidePanelToggle/><PluginSidePanel/></SidePanelProvider></PluginProvider></MantineProvider>;
  const rendered = render(content("transcript"));

  fireEvent.click(screen.getByRole("button",{name:"Toggle side panel"}));
  expect(screen.getByText("Transcript content")).toBeTruthy();
  rendered.rerender(content("home"));

  expect(screen.queryByText("Transcript content")).toBeNull();
  expect(screen.getByText("Always content")).toBeTruthy();
  expect(screen.getByRole("button",{name:"Toggle side panel"}).getAttribute("aria-expanded")).toBe("true");
});
it("filters panels by view and closes when none remain available",()=>{
  const plugins = [{id:"example",ui:{Provider:({children}:{children:React.ReactNode})=>children,contributions:[
    {id:"example.transcript",placement:"side-panel" as const,label:"Transcript",Icon:()=>null,Component:()=> <div>Transcript content</div>,available:(context:{view:"home" | "transcript"})=>context.view==="transcript"},
  ]}}];
  const content = (view:"home" | "transcript")=><MantineProvider><PluginProvider plugins={plugins} host={host}><SidePanelProvider view={view}><SidePanelToggle/><PluginSidePanel/></SidePanelProvider></PluginProvider></MantineProvider>;
  const rendered = render(content("transcript"));

  fireEvent.click(screen.getByRole("button",{name:"Toggle side panel"}));
  expect(screen.getByText("Transcript content")).toBeTruthy();
  rendered.rerender(content("home"));
  expect(screen.queryByRole("button",{name:"Toggle side panel"})).toBeNull();
  expect(screen.queryByText("Transcript content")).toBeNull();
  rendered.rerender(content("transcript"));
  expect(screen.getByRole("button",{name:"Toggle side panel"}).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("Transcript content")).toBeNull();
});
