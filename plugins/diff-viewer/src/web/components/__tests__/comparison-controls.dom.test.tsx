// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ComparisonControls } from "../ComparisonControls.js";
import type { Preferences } from "../../stores/DiffViewerProvider.js";

afterEach(cleanup);
function controls(preferences:Preferences, onToggleWrap=vi.fn()) {
  const update = vi.fn();
  render(<MantineProvider><ComparisonControls preferences={preferences} update={update}
    context={{status:"ready",value:{branch:"feature",branches:[]}}}
    commits={{status:"ready",value:{commits:[{sha:"a".repeat(40),subject:"Improve viewer",author:"Test",date:"2026-01-01"}],nextOffset:null}}}
    wrap={true} onToggleWrap={onToggleWrap} onQuery={vi.fn()} offset={0} onNext={vi.fn()} onPrevious={vi.fn()} loading={false} disabled={false} onRefresh={vi.fn()}/></MantineProvider>);
  return update;
}
it("omits the duplicate current branch label in every comparison mode",()=>{
  for (const mode of ["branch","uncommitted","commit"] as const) {
    controls({mode,branch:null,commit:null,commitSubject:""});

    expect(screen.queryByText("feature")).toBeNull();
    expect(screen.getByRole("combobox",{name:"Comparison mode"})).toBeTruthy();

    cleanup();
  }
});

it("offers an accessible wrap toggle without a duplicate branch icon",()=>{
  const toggle = vi.fn();
  controls({mode:"branch",branch:null,commit:null,commitSubject:""},toggle);

  const button = screen.getByRole("button",{name:"Wrap lines"});
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(document.querySelector(".tabler-icon-git-branch")).toBeNull();

  fireEvent.click(button);

  expect(toggle).toHaveBeenCalledOnce();
});

it("shows commit messages without hashes and selects their opaque identity",()=>{
  const update = controls({mode:"commit",branch:null,commit:null,commitSubject:""});
  fireEvent.click(screen.getByRole("combobox",{name:"Comparison commit"}));
  fireEvent.click(screen.getByRole("option",{name:"Improve viewer"}));

  expect(update).toHaveBeenCalledWith({commit:"a".repeat(40),commitSubject:"Improve viewer"});
  expect(document.body.textContent).not.toContain("a".repeat(40));
});
it("keeps a selected commit readable after its page is no longer listed",()=>{
  controls({mode:"commit",branch:null,commit:"b".repeat(40),commitSubject:"Older chosen commit"});

  expect((screen.getByRole("combobox",{name:"Comparison commit"}) as HTMLInputElement).value).toBe("Older chosen commit");
  expect(document.body.textContent).not.toContain("b".repeat(40));
});
it("does not add a second picker or redundant labels in Uncommitted mode",()=>{
  controls({mode:"uncommitted",branch:null,commit:null,commitSubject:""});

  expect(screen.queryByRole("combobox",{name:"Comparison commit"})).toBeNull();
  expect(screen.queryByRole("combobox",{name:"Comparison branch"})).toBeNull();
  expect(screen.queryByText("Read-only")).toBeNull();
  expect(screen.queryByText("Base")).toBeNull();
  expect(screen.queryByText("Split")).toBeNull();
});
