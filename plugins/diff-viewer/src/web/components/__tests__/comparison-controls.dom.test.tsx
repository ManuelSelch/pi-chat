// @vitest-environment jsdom
import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ComparisonControls } from "../ComparisonControls.js";
import type { Preferences } from "../../stores/DiffViewerProvider.js";
import type { RepositoryContext } from "../../../contract.js";

const context: RepositoryContext = {branch:"feature",defaultBranch:"refs/heads/main",suggestedBranches:["refs/heads/parent"],branches:[
  {ref:"refs/heads/main",name:"main",remote:false},
  {ref:"refs/heads/parent",name:"parent",remote:false},
  {ref:"refs/heads/unrelated",name:"unrelated",remote:false},
  {ref:"refs/remotes/origin/parent",name:"origin/parent",remote:true},
]};
afterEach(cleanup);
function controls(preferences:Preferences, onToggleWrap=vi.fn(), disabled=false) {
  const update = vi.fn();
  function Harness() {
    const [value,setValue] = useState(preferences);
    return <MantineProvider env="test"><ComparisonControls preferences={value} update={patch=>{update(patch);setValue(current=>({...current,...patch}));}}
      context={{status:"ready",value:context}}
      commits={{status:"ready",value:{commits:[{sha:"a".repeat(40),subject:"Improve viewer",author:"Test",date:"2026-01-01"}]}}}
      wrap={true} onToggleWrap={onToggleWrap} loading={false} disabled={disabled} onRefresh={vi.fn()}/></MantineProvider>;
  }
  render(<Harness/>);
  return update;
}
it("omits the duplicate current branch label in every comparison mode",()=>{
  for (const mode of ["branch","uncommitted","commit"] as const) {
    controls({mode,branch:null,commit:null,commitSubject:""});

    expect(screen.queryByText("feature")).toBeNull();
    expect(screen.getByRole("button",{name:"Comparison mode"})).toBeTruthy();

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
it("keeps the selected base visible and initially shows only default and suggested bases",()=>{
  controls({mode:"branch",branch:"refs/heads/main",commit:null,commitSubject:""});
  const trigger = screen.getByRole("button",{name:"Comparison branch"});

  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(trigger);

  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.textContent).toBe("Againstmain");
  expect(screen.getAllByRole("option").map(option=>option.getAttribute("aria-label"))).toEqual(["main","parent"]);
  expect(screen.queryByText("Compare against")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
});
it("searches all branches separately and returns using a small back button",async()=>{
  controls({mode:"branch",branch:"refs/heads/main",commit:null,commitSubject:""});
  fireEvent.click(screen.getByRole("button",{name:"Comparison branch"}));
  fireEvent.click(screen.getByRole("button",{name:"Search all branches…"}));

  const search = screen.getByRole("textbox",{name:"Search all branches"});
  await waitFor(()=>expect(document.activeElement).toBe(search));
  fireEvent.change(search,{target:{value:"unrelated"}});
  expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(screen.getByRole("button",{name:"Comparison branch"}).textContent).toBe("Againstmain");

  fireEvent.click(screen.getByRole("button",{name:"Back to suggestions"}));

  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByText("Back to suggestions")).toBeNull();
  expect(screen.getAllByRole("option")).toHaveLength(2);
});
it("selects a search result and keeps it in the short list on reopening",()=>{
  const update = controls({mode:"branch",branch:"refs/heads/main",commit:null,commitSubject:""});
  fireEvent.click(screen.getByRole("button",{name:"Comparison branch"}));
  fireEvent.click(screen.getByRole("button",{name:"Search all branches…"}));
  fireEvent.click(screen.getByRole("option",{name:"origin/parent"}));

  expect(update).toHaveBeenCalledWith({branch:"refs/remotes/origin/parent"});
  expect(screen.getByRole("button",{name:"Comparison branch"}).textContent).toBe("Againstorigin/parent");
  fireEvent.click(screen.getByRole("button",{name:"Comparison branch"}));
  expect(screen.getByRole("option",{name:"origin/parent"})).toBeTruthy();
  expect(screen.queryByText("Remote, different tip")).toBeNull();
});
it("shows recent commit messages without hashes, search or pagination",()=>{
  const update = controls({mode:"commit",branch:null,commit:null,commitSubject:""});
  fireEvent.click(screen.getByRole("button",{name:"Comparison commit"}));

  expect(screen.getByText("Latest")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button",{name:"Older"})).toBeNull();
  expect(screen.queryByRole("button",{name:"Newer"})).toBeNull();
  fireEvent.click(screen.getByRole("option",{name:"Improve viewer"}));

  expect(update).toHaveBeenCalledWith({commit:"a".repeat(40),commitSubject:"Improve viewer"});
  expect(document.body.textContent).not.toContain("a".repeat(40));
});
it("keeps a selected commit readable after it leaves the recent list",()=>{
  controls({mode:"commit",branch:null,commit:"b".repeat(40),commitSubject:"Older chosen commit"});

  expect(screen.getByRole("button",{name:"Comparison commit"}).textContent).toBe("Older chosen commit");
  expect(document.body.textContent).not.toContain("b".repeat(40));
});
it("does not add a second picker or redundant labels in Uncommitted mode",()=>{
  controls({mode:"uncommitted",branch:null,commit:null,commitSubject:""});

  expect(screen.queryByRole("button",{name:"Comparison commit"})).toBeNull();
  expect(screen.queryByRole("button",{name:"Comparison branch"})).toBeNull();
  expect(screen.queryByText("Read-only")).toBeNull();
  expect(screen.queryByText("Base")).toBeNull();
  expect(screen.queryByText("Split")).toBeNull();
});
it("changes mode with a non-searchable menu and preserves the chosen base",()=>{
  const update = controls({mode:"branch",branch:"refs/heads/parent",commit:null,commitSubject:""});
  fireEvent.click(screen.getByRole("button",{name:"Comparison mode"}));
  fireEvent.click(screen.getByRole("menuitem",{name:"Uncommitted"}));

  expect(update).toHaveBeenCalledWith({mode:"uncommitted"});
  expect(screen.queryByRole("button",{name:"Comparison branch"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Comparison mode"}));
  fireEvent.click(screen.getByRole("menuitem",{name:"Branch"}));
  expect(screen.getByRole("button",{name:"Comparison branch"}).textContent).toBe("Againstparent");
});
it("disables selection and refresh while disconnected",()=>{
  controls({mode:"branch",branch:null,commit:null,commitSubject:""},vi.fn(),true);

  expect((screen.getByRole("button",{name:"Comparison branch"}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button",{name:"Refresh changes"}) as HTMLButtonElement).disabled).toBe(true);
});
