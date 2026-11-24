// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FileNavigation } from "../FileNavigation.js";

afterEach(()=>{cleanup();vi.useRealTimers();});

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
