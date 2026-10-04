// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FolderPicker } from "../src/web/sessions/folders/FolderPicker.js";
import type { DirectoryListing } from "../src/shared/directories.js";

afterEach(cleanup);
const listing: DirectoryListing = {
  path: "/server/work", parentPath: "/server",
  breadcrumbs: [{ name: "/", path: "/" }, { name: "server", path: "/server" }, { name: "work", path: "/server/work" }],
  entries: [{ name: "fresh-project", path: "/server/work/fresh-project" }],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function show(overrides: Record<string, unknown> = {}) {
  const props = { opened: true, connected: true, initialPath: "/server/work", onClose: vi.fn(),
    browseDirectories: vi.fn(async () => listing), startSession: vi.fn(async () => "session"), ...overrides };
  const view = render(<MantineProvider><FolderPicker {...props} /></MantineProvider>);
  return { ...props, ...view, update: (patch: Record<string, unknown>) => view.rerender(<MantineProvider><FolderPicker {...props} {...patch} /></MantineProvider>) };
}

describe("server folder picker", () => {
  it("shows the path only in the input and breadcrumbs, without explanatory labels", async () => {
    show();
    await screen.findByRole("button", { name: "fresh-project" });
    expect(screen.queryByText("Folders on the Pi Chat server")).toBeNull();
    expect(screen.queryByText("/server/work", { exact: true })).toBeNull();
    expect((screen.getByRole("textbox", { name: "Server folder path" }) as HTMLInputElement).value).toBe("/server/work");
    expect(screen.getByRole("button", { name: "work" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
  });
  it("opens the current folder with Enter instead of browsing again", async () => {
    const { startSession, browseDirectories, onClose } = show();
    await screen.findByRole("button", { name: "fresh-project" });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Server folder path" }), { key: "Enter" });
    await waitFor(() => expect(startSession).toHaveBeenCalledWith("/server/work", expect.any(AbortSignal)));
    expect(browseDirectories).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("does not open while loading or when Enter finishes IME composition", async () => {
    const pending = deferred<DirectoryListing>();
    const { startSession } = show({ browseDirectories: vi.fn(() => pending.promise) });
    const input = screen.getByRole("textbox", { name: "Server folder path" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(startSession).not.toHaveBeenCalled();
    await act(async () => pending.resolve(listing));
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(startSession).not.toHaveBeenCalled();
  });
  it("resolves an edited relative path before opening it with Enter", async () => {
    const browse = vi.fn().mockResolvedValueOnce(listing).mockResolvedValueOnce({ ...listing, path: "/server/other", entries: [] });
    const { startSession } = show({ browseDirectories: browse });
    await screen.findByRole("button", { name: "fresh-project" });
    const input = screen.getByRole("textbox", { name: "Server folder path" });
    fireEvent.change(input, { target: { value: "../other" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(startSession).toHaveBeenCalledWith("/server/other", expect.any(AbortSignal)));
    expect(browse).toHaveBeenLastCalledWith({ path: "../other", basePath: "/server/work", showHidden: false }, expect.any(AbortSignal));
  });
  it("does not open the previous folder when an edited path is invalid", async () => {
    const browse = vi.fn().mockResolvedValueOnce(listing).mockRejectedValueOnce(new Error("Folder not found"));
    const { startSession, onClose } = show({ browseDirectories: browse });
    await screen.findByRole("button", { name: "fresh-project" });
    const input = screen.getByRole("textbox", { name: "Server folder path" });
    fireEvent.change(input, { target: { value: "/missing" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText("Folder not found");
    expect(startSession).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
  it("browses the current folder without starting a session, and navigates rows", async () => {
    const { browseDirectories, startSession } = show();
    await screen.findByRole("button", { name: "fresh-project" });
    expect(browseDirectories).toHaveBeenCalledWith({ path: "/server/work", showHidden: false }, expect.any(AbortSignal));
    expect(startSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "fresh-project" }));
    await waitFor(() => expect(browseDirectories).toHaveBeenLastCalledWith({ path: "/server/work/fresh-project", basePath: "/server/work", showHidden: false }, expect.any(AbortSignal)));
  });
  it("supports path entry, parent/home navigation and hidden folders", async () => {
    const { browseDirectories } = show();
    await screen.findByRole("button", { name: "fresh-project" });
    fireEvent.change(screen.getByRole("textbox", { name: "Server folder path" }), { target: { value: "../other" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(browseDirectories).toHaveBeenLastCalledWith({ path: "../other", basePath: "/server/work", showHidden: false }, expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole("button", { name: "Up" }));
    await waitFor(() => expect(browseDirectories).toHaveBeenLastCalledWith({ path: "/server", basePath: "/server/work", showHidden: false }, expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    await waitFor(() => expect(browseDirectories).toHaveBeenLastCalledWith({ path: "~", basePath: "/server/work", showHidden: false }, expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole("checkbox", { name: "Show hidden folders" }));
    await waitFor(() => expect(browseDirectories).toHaveBeenLastCalledWith({ path: "/server/work", basePath: "/server/work", showHidden: true }, expect.any(AbortSignal)));
  });
  it("keeps the last successful folder on navigation failure", async () => {
    const browse = vi.fn().mockResolvedValueOnce(listing).mockRejectedValueOnce(new Error("Permission denied"));
    show({ browseDirectories: browse });
    await screen.findByRole("button", { name: "fresh-project" });
    fireEvent.click(screen.getByRole("button", { name: "fresh-project" }));
    await screen.findByText("Permission denied");
    expect((screen.getByRole("textbox", { name: "Server folder path" }) as HTMLInputElement).value).toBe("/server/work");
  });
  it("disables creation while listing, ignores stale replies, and shows empty folders", async () => {
    const first = deferred<DirectoryListing>();
    const second = deferred<DirectoryListing>();
    const browse = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    show({ browseDirectories: browse });
    expect((screen.getByRole("button", { name: "Open" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    await act(async () => second.resolve({ ...listing, path: "/home", entries: [] }));
    await screen.findByText("No subfolders.");
    await act(async () => first.resolve(listing));
    expect(screen.queryByRole("button", { name: "fresh-project" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "Server folder path" }) as HTMLInputElement).value).toBe("/home");
  });
  it("paginates and refresh resets the cursor", async () => {
    const browse = vi.fn().mockResolvedValueOnce({ ...listing, nextCursor: "fresh-project" }).mockResolvedValue({ ...listing, entries: [{ name: "z", path: "/server/work/z" }] });
    show({ browseDirectories: browse });
    await screen.findByRole("button", { name: "Load more folders" });
    fireEvent.click(screen.getByRole("button", { name: "Load more folders" }));
    await screen.findByRole("button", { name: "z" });
    expect(screen.getByRole("button", { name: "fresh-project" })).toBeTruthy();
    expect(browse).toHaveBeenLastCalledWith({ path: "/server/work", basePath: "/server/work", showHidden: false, cursor: "fresh-project" }, expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(browse).toHaveBeenLastCalledWith({ path: "/server/work", basePath: "/server/work", showHidden: false }, expect.any(AbortSignal)));
  });
  it("closes only after successful creation and preserves failures inline", async () => {
    const pending = deferred<string>();
    const start = vi.fn().mockRejectedValueOnce(new Error("Folder disappeared")).mockReturnValueOnce(pending.promise);
    const { onClose } = show({ startSession: start });
    await screen.findByRole("button", { name: "fresh-project" });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByText("Folder disappeared");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => pending.resolve("new-session"));
    expect(onClose).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith("/server/work", expect.any(AbortSignal));
  });
  it("cancels browsing without starting a session", async () => {
    const { onClose, startSession } = show();
    await screen.findByRole("button", { name: "fresh-project" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(startSession).not.toHaveBeenCalled();
  });
  it("disables creation on disconnect and refreshes on reconnect", async () => {
    const { update, browseDirectories } = show();
    await screen.findByRole("button", { name: "fresh-project" });
    update({ connected: false });
    expect(screen.getByText(/Reconnect to browse/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Open" }) as HTMLButtonElement).disabled).toBe(true);
    update({ connected: true });
    await waitFor(() => expect(browseDirectories).toHaveBeenCalledTimes(2));
  });
  it("disables Up at a filesystem root", async () => {
    show({ initialPath: undefined, browseDirectories: vi.fn(async () => ({ path: "/", breadcrumbs: [{ name: "/", path: "/" }], entries: [] })) });
    await screen.findByText("No subfolders.");
    expect((screen.getByRole("button", { name: "Up" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
