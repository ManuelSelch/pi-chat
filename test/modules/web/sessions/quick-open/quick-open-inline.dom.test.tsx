// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QuickOpen } from "../../../../../src/web/sessions/quick-open/QuickOpen.js";

afterEach(cleanup);
it("filters the shared quickswitcher inline while keeping Home activity visible", () => {
  const run = vi.fn();
  render(<MantineProvider><QuickOpen inline opened={false} onClose={vi.fn()} catalogue={{ projects: [] }} tabs={[]} onOpenSession={vi.fn()} onFocusSession={vi.fn()} onOpenProject={vi.fn()} onNewSession={vi.fn()} actions={[{ id: "settings", name: "Settings", description: "Open settings", run }]} /><section>Activity</section></MantineProvider>);
  const input = screen.getByPlaceholderText("Search");
  fireEvent.change(input, { target: { value: "/settings" } });
  expect(screen.getByRole("option", { name: /Settings/ })).toBeTruthy();
  expect(screen.getByText("Activity")).toBeTruthy();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(run).toHaveBeenCalledOnce();
});

it("keeps only the outer border in both inline switcher states", () => {
  render(<MantineProvider><QuickOpen inline opened={false} onClose={vi.fn()} catalogue={{ projects: [] }} tabs={[]} onOpenSession={vi.fn()} onFocusSession={vi.fn()} onOpenProject={vi.fn()} onNewSession={vi.fn()} /></MantineProvider>);
  const input = screen.getByPlaceholderText("Search") as HTMLInputElement;

  const frame = input.closest('[data-home-quick-open-frame]') as HTMLElement;
  expect(frame.style.borderColor).not.toBe("transparent");
  expect(input.style.borderColor).toBe("transparent");
  fireEvent.click(input);
  expect(frame.style.borderColor).not.toBe("transparent");
  expect(input.style.borderColor).toBe("transparent");
  fireEvent.keyDown(input, { key: "Escape" });
  expect(frame.style.borderColor).not.toBe("transparent");
  expect(input.style.borderColor).toBe("transparent");
});

it("opens a matching saved session with Enter", () => {
  const open = vi.fn();
  const catalogue = { projects: [{ path: "/project", displayPath: "/project", name: "project", exists: true, modified: 10, sessionCount: 1, sessions: [{ path: "/study.jsonl", id: "study", title: "Study Notes", nameSource: "manual" as const, modified: 10, created: 1, messageCount: 2 }] }] };
  render(<MantineProvider><QuickOpen inline opened={false} onClose={vi.fn()} catalogue={catalogue} tabs={[]} onOpenSession={open} onFocusSession={vi.fn()} onOpenProject={vi.fn()} onNewSession={vi.fn()} /></MantineProvider>);
  const input = screen.getByPlaceholderText("Search");
  fireEvent.change(input, { target: { value: "Study" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(open).toHaveBeenCalledWith("/study.jsonl");
});

it("retains the initial empty Enter shortcut for a new session", () => {
  const create = vi.fn();
  render(<MantineProvider><QuickOpen inline opened={false} onClose={vi.fn()} catalogue={{ projects: [] }} tabs={[]} onOpenSession={vi.fn()} onFocusSession={vi.fn()} onOpenProject={vi.fn()} onNewSession={create} /></MantineProvider>);
  const input = screen.getByPlaceholderText("Search");
  expect(document.activeElement).toBe(input);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(create).toHaveBeenCalledOnce();
});
