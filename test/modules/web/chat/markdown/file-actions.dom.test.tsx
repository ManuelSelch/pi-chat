// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileActionsProvider, useFileAction } from "../../../../../src/web/chat/markdown/FileActions.js";
function Probe() {
  const open = useFileAction();
  return <button onClick={() => open("session-a", "report.pdf")}>Open report</button>;
}
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("file action feedback", () => {
  it("shows bounded, dismissible failures outside history, identified by file and session", async () => {
    const openFile = vi.fn(async () => { throw new Error("File not found on the server."); });
    render(<MantineProvider><FileActionsProvider openFile={openFile}><Probe /></FileActionsProvider></MantineProvider>);
    await act(async () => fireEvent.click(screen.getByText("Open report")));
    expect(openFile).toHaveBeenCalledWith("session-a", "report.pdf");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("report.pdf");
    expect(alert.textContent).toContain("session-a");
    expect(alert.textContent).toContain("File not found on the server");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss file error" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("keeps independent failures bounded and coalesces repeats for the same file", async () => {
    function Files() {
      const open = useFileAction();
      return <>{[0, 1, 2, 3].map((index) => <button key={index} onClick={() => open("session-a", `${index}.pdf`)}>Open {index}</button>)}</>;
    }
    render(<MantineProvider><FileActionsProvider openFile={async () => { throw new Error("Error"); }}><Files /></FileActionsProvider></MantineProvider>);
    for (const index of [0, 1, 2, 3, 3]) await act(async () => fireEvent.click(screen.getByText(`Open ${index}`)));
    expect(screen.getAllByRole("alert")).toHaveLength(3);
    expect(screen.queryByText("File: 0.pdf")).toBeNull();
    expect(screen.getByText("File: 1.pdf")).not.toBeNull();
    expect(screen.getByText("File: 3.pdf")).not.toBeNull();
  });

  it("has no success or cancellation toast", async () => {
    const openFile = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(Object.assign(new Error("Cancelled"), { name: "AbortError" }));
    render(<MantineProvider><FileActionsProvider openFile={openFile}><Probe /></FileActionsProvider></MantineProvider>);
    await act(async () => fireEvent.click(screen.getByText("Open report")));
    await act(async () => fireEvent.click(screen.getByText("Open report")));
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("expires failures without writing to chat state", async () => {
    vi.useFakeTimers();
    render(<MantineProvider><FileActionsProvider openFile={async () => { throw new Error("Error"); }}><Probe /></FileActionsProvider></MantineProvider>);
    await act(async () => fireEvent.click(screen.getByText("Open report")));
    expect(screen.getByRole("alert")).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(8000));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
