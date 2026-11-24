// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FileNavigation } from "../FileNavigation.js";

afterEach(()=>{cleanup();vi.useRealTimers();});

it("groups files by kind with compact folders and no Files header",()=>{
  const files = ["src/checkout/Pay.tsx","src/checkout/__tests__/Pay.test.tsx","docs/checkout.md","package.json"].map(path=>({path,status:"M" as const,binary:false,patch:"",added:0,removed:0}));
  render(<MantineProvider><FileNavigation files={files} selected={files[0]!.path} onSelect={vi.fn()}/></MantineProvider>);
  const nav = screen.getByRole("navigation",{name:"Changed files"});

  expect(within(nav).getByRole("button",{name:"Source"}).getAttribute("aria-expanded")).toBe("true");
  expect(within(nav).getByRole("button",{name:"Tests"})).toBeTruthy();
  expect(within(nav).getByRole("button",{name:"Docs"})).toBeTruthy();
  expect(within(nav).getByRole("button",{name:"Config"})).toBeTruthy();
  expect(within(nav).getByText("src/checkout")).toBeTruthy();
  expect(within(nav).queryByText("Files")).toBeNull();

  fireEvent.click(within(nav).getByRole("button",{name:"Source"}));

  expect(within(nav).queryByRole("button",{name:"src/checkout/Pay.tsx"})).toBeNull();
  expect(within(nav).getByRole("button",{name:"src/checkout/__tests__/Pay.test.tsx"})).toBeTruthy();

  fireEvent.click(within(nav).getByRole("button",{name:"Source"}));
  fireEvent.click(within(nav).getByRole("button",{name:"Folder src/checkout"}));

  expect(within(nav).queryByRole("button",{name:"src/checkout/Pay.tsx"})).toBeNull();
});

it("keeps full paths accessible without hover tooltips",async()=>{
  vi.useFakeTimers();
  const select = vi.fn();
  const path = "src/deeply/nested/file.ts";
  render(<MantineProvider><FileNavigation files={[{path,status:"M",binary:false,patch:"",added:0,removed:0}]} selected={path} onSelect={select}/></MantineProvider>);
  const button = screen.getByRole("button",{name:path});

  fireEvent.mouseEnter(button);
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});

  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(button.hasAttribute("title")).toBe(false);
  expect(screen.getByText("file.ts")).toBeTruthy();

  fireEvent.click(button);

  expect(select).toHaveBeenCalledWith(path);
});
